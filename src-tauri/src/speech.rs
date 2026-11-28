use reqwest::blocking::Client;
use std::{
    fs::{self, File},
    io::{self, BufWriter},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

pub type SharedSpeechEngine = Arc<Mutex<Option<WhisperContext>>>;

const MODEL_FILE: &str = "ggml-base.bin";
const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin";
const MAX_AUDIO_SAMPLES: usize = 16_000 * 30;

fn ensure_model(model_dir: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(model_dir)
        .map_err(|error| format!("Could not create the local model directory: {error}"))?;

    let model_path = model_dir.join(MODEL_FILE);
    if model_path.exists() {
        let size = fs::metadata(&model_path)
            .map_err(|error| format!("Could not inspect the speech model: {error}"))?
            .len();
        if size > 100_000_000 {
            return Ok(model_path);
        }
        let _ = fs::remove_file(&model_path);
    }

    let partial_path = model_dir.join(format!("{MODEL_FILE}.download"));
    let client = Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .timeout(Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Could not initialise the model downloader: {error}"))?;

    let response = client
        .get(MODEL_URL)
        .send()
        .and_then(|response| response.error_for_status())
        .map_err(|error| {
            format!(
                "Could not download the offline speech model. Check your internet connection and try again. Details: {error}"
            )
        })?;

    let mut output = BufWriter::new(
        File::create(&partial_path)
            .map_err(|error| format!("Could not create the model file: {error}"))?,
    );
    let mut response = response;
    io::copy(&mut response, &mut output)
        .map_err(|error| format!("The model download was interrupted: {error}"))?;
    drop(output);

    let size = fs::metadata(&partial_path)
        .map_err(|error| format!("Could not verify the downloaded model: {error}"))?
        .len();
    if size < 100_000_000 {
        let _ = fs::remove_file(&partial_path);
        return Err("The downloaded speech model is incomplete. Please try again.".into());
    }

    fs::rename(&partial_path, &model_path)
        .map_err(|error| format!("Could not install the speech model: {error}"))?;
    Ok(model_path)
}

pub fn transcribe(
    engine: &SharedSpeechEngine,
    model_dir: &Path,
    samples: Vec<f32>,
) -> Result<String, String> {
    if samples.len() < 4_000 {
        return Err("That recording was too short. Please try speaking again.".into());
    }
    if samples.len() > MAX_AUDIO_SAMPLES {
        return Err("That recording exceeded the 30-second limit.".into());
    }
    if samples.iter().any(|sample| !sample.is_finite()) {
        return Err("The recording contained invalid audio data.".into());
    }

    let mut engine = engine
        .lock()
        .map_err(|_| "The local speech engine is unavailable. Restart TRACE.".to_string())?;

    if engine.is_none() {
        let model_path = ensure_model(model_dir)?;
        let context = WhisperContext::new_with_params(
            model_path
                .to_str()
                .ok_or_else(|| "The model path contains unsupported characters.".to_string())?,
            WhisperContextParameters::default(),
        )
        .map_err(|error| format!("Could not load the local speech model: {error}"))?;
        *engine = Some(context);
    }

    let context = engine
        .as_ref()
        .ok_or_else(|| "The local speech model did not initialise.".to_string())?;
    let mut state = context
        .create_state()
        .map_err(|error| format!("Could not initialise speech recognition: {error}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_n_threads(4);
    params.set_no_context(true);
    params.set_no_timestamps(true);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);

    state
        .full(params, &samples)
        .map_err(|error| format!("Local transcription failed: {error}"))?;

    let mut transcript = String::new();
    for segment in state.as_iter() {
        let text = segment
            .to_str_lossy()
            .map_err(|error| format!("Could not read the transcription: {error}"))?;
        transcript.push_str(text.trim());
        transcript.push(' ');
    }

    let transcript = transcript.trim().to_string();
    if transcript.is_empty() {
        return Err("I couldn't make out the words. Please try speaking a little more clearly.".into());
    }
    Ok(transcript)
}
