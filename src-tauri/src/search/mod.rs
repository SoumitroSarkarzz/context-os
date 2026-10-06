use crate::{models::SearchResult, Result};
use rusqlite::Connection;
pub fn search(db: &Connection, query: &str) -> Result<Vec<SearchResult>> {
    let words: Vec<String> = query
        .split_whitespace()
        .take(20)
        .filter_map(|word| {
            let text = word.trim_matches(|c: char| !c.is_alphanumeric());
            if text.is_empty() {
                None
            } else {
                Some(format!("\"{}\"*", text.replace('"', "\"\"")))
            }
        })
        .collect();
    if words.is_empty() {
        return Ok(vec![]);
    }
    let expression = words.join(" AND ");
    let mut statement=db.prepare("SELECT entity_id,context_id,kind,title,snippet(memory_index,4,'','', ' … ',24),CAST(timestamp AS INTEGER) FROM memory_index WHERE memory_index MATCH ?1 ORDER BY rank LIMIT 100")?;
    let rows = statement.query_map([expression], |r| {
        Ok(SearchResult {
            id: r.get(0)?,
            context_id: r.get(1)?,
            kind: r.get(2)?,
            title: r.get(3)?,
            excerpt: r.get(4)?,
            timestamp: r.get(5)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}
