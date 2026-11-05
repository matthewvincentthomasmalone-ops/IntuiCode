//! Count how often each word appears in a text file.
use std::collections::HashMap;
use std::fs;
use std::io;

const TOP_N: usize = 10;

#[derive(Debug, Clone, PartialEq)]
pub struct WordCount {
    pub word: String,
    pub count: usize,
}

pub enum Order {
    MostFirst,
    Alphabetical,
}

/// Split text into lower-case words and count each one.
pub fn count_words(text: &str) -> HashMap<String, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        let clean: String = word.chars().filter(|c| c.is_alphanumeric()).collect();
        if clean.is_empty() {
            continue;
        }
        *counts.entry(clean.to_lowercase()).or_insert(0) += 1;
    }
    counts
}

pub fn sorted(counts: &HashMap<String, usize>, order: Order) -> Vec<WordCount> {
    let mut list: Vec<WordCount> = counts
        .iter()
        .map(|(w, c)| WordCount { word: w.clone(), count: *c })
        .collect();
    match order {
        Order::MostFirst => list.sort_by(|a, b| b.count.cmp(&a.count)),
        Order::Alphabetical => list.sort_by(|a, b| a.word.cmp(&b.word)),
    }
    list
}

fn read_file(path: &str) -> Result<String, io::Error> {
    let text = fs::read_to_string(path)?;
    Ok(text)
}

fn main() -> Result<(), io::Error> {
    let path = std::env::args().nth(1).unwrap_or_else(|| "book.txt".to_string());
    let text = read_file(&path)?;
    for wc in sorted(&count_words(&text), Order::MostFirst).iter().take(TOP_N) {
        println!("{:>6} {}", wc.count, wc.word);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_repeated_words() {
        let c = count_words("the cat and the hat");
        assert_eq!(c["the"], 2);
    }
}
