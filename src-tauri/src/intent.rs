use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchIntent { ImageSearch, WebSearch, Clarification }

#[derive(Debug, Serialize)]
pub struct ParsedRequest {
    pub intent: SearchIntent,
    pub query: String,
    pub search_engine: &'static str,
    pub confidence: &'static str,
    pub guidance: String,
}

fn clean_query(value: &str) -> String {
    value.trim().trim_matches(|c: char| c.is_ascii_punctuation() || c.is_whitespace()).split_whitespace().collect::<Vec<_>>().join(" ")
}

fn strip_prefix<'a>(text: &'a str, prefixes: &[&str]) -> Option<&'a str> {
    prefixes.iter().find_map(|prefix| text.strip_prefix(prefix).map(|rest| rest.trim_start_matches(|c: char| c.is_whitespace() || c == ':' || c == ',')))
}

#[tauri::command]
pub fn interpret_request(transcript: String) -> Result<ParsedRequest, String> {
    let original = transcript.trim();
    if original.is_empty() { return Err("I didn't hear a search request. Please try again.".into()); }
    let lower = original.to_lowercase();
    let image_prefixes = [
        "i want to find pictures of ", "i want to find images of ", "i want to find photos of ",
        "find pictures of ", "find images of ", "find photos of ",
        "show me pictures of ", "show me images of ", "show me photos of ",
        "look for pictures of ", "look for images of ", "look for photos of ",
        "search images for ", "search google images for ", "pictures of ", "images of ", "photos of ",
    ];
    if image_prefixes.iter().any(|prefix| lower == prefix.trim()) {
        return Ok(ParsedRequest {
            intent: SearchIntent::Clarification,
            query: String::new(),
            search_engine: "google",
            confidence: "low",
            guidance: "What pictures would you like me to find?".into(),
        });
    }
    if let Some(rest) = strip_prefix(&lower, &image_prefixes) {
        let query = clean_query(rest);
        if query.is_empty() {
            return Ok(ParsedRequest { intent: SearchIntent::Clarification, query, search_engine: "google", confidence: "low", guidance: "What pictures would you like me to find?".into() });
        }
        return Ok(ParsedRequest { intent: SearchIntent::ImageSearch, query, search_engine: "google", confidence: "high", guidance: "I'll help you find pictures on Google Images.".into() });
    }
    let web_prefixes = [
        "i want to search for ", "search the web for ", "search google for ", "search for ",
        "look up ", "find information about ", "find information on ", "tell me about ", "i want to know about ",
    ];
    let web_query = strip_prefix(&lower, &web_prefixes).map(clean_query).filter(|query| !query.is_empty());
    let query = web_query.clone().unwrap_or_else(|| clean_query(original));
    if query.split_whitespace().count() < 2 && !lower.starts_with("what is ") && !lower.starts_with("who is ") && !lower.starts_with("where is ") && !lower.starts_with("how to ") {
        return Ok(ParsedRequest { intent: SearchIntent::Clarification, query, search_engine: "google", confidence: "low", guidance: "Could you tell me a little more about what you'd like to search for?".into() });
    }
    Ok(ParsedRequest { intent: SearchIntent::WebSearch, query, search_engine: "google", confidence: if web_query.is_some() { "high" } else { "medium" }, guidance: "I'll help you search the web on Google.".into() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognises_image_search_requests() {
        let parsed = interpret_request("Find pictures of fluffy cats".into()).unwrap();
        assert!(matches!(&parsed.intent, SearchIntent::ImageSearch));
        assert_eq!(parsed.query, "fluffy cats");
        assert_eq!(parsed.search_engine, "google");
    }

    #[test]
    fn recognises_general_web_search_requests() {
        let parsed = interpret_request("Search for beginner gardening tips".into()).unwrap();
        assert!(matches!(&parsed.intent, SearchIntent::WebSearch));
        assert_eq!(parsed.query, "beginner gardening tips");
    }

    #[test]
    fn asks_for_clarification_when_image_subject_is_missing() {
        let parsed = interpret_request("Find pictures of ".into()).unwrap();
        assert!(matches!(&parsed.intent, SearchIntent::Clarification));
        assert!(parsed.query.is_empty());
    }
}
