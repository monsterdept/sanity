//! Watching a run from the terminal: the readings as they land, and a progress line under them.
//!
//! Polled, not streamed: [`tail`] asks `/status` every two seconds for whatever is newer than
//! the last event it printed. On a terminal the [`Board`] keeps the column header, the last
//! few readings and the progress line as one fixed block rewritten in place; in a log or a
//! pipe every reading is printed as it lands, with no chrome. Ctrl-C stops the run and Ctrl-X
//! stops only the watching. A backend that goes away mid-run is followed, once, to whoever
//! took over, and a run that ends prints what it spent.

use super::backend::{await_backend, get, post, START_WAIT};
use super::check::{resume, Wanted};
use super::{commas, fancy, num, plural, text};
use crate::agentapi::Endpoint;
use crate::mcp::urlencode;
use serde_json::{json, Value};
use std::time::{Duration, Instant};

/// The width of the drawn bar, in cells. Short on purpose: it shares a line with the
/// counts, and the counts are the part somebody actually reads.
const BAR: usize = 20;

fn bar(frac: f64) -> String {
    let full = (frac.clamp(0.0, 1.0) * BAR as f64).round() as usize;
    format!("{}{}", "█".repeat(full), "░".repeat(BAR - full))
}

/// `3m20s`, or `40s` under a minute. Elapsed rather than a clock time: what matters is how
/// long this has been going, and nobody needs to know it started at 02:14.
fn elapsed(since: Instant) -> String {
    let s = since.elapsed().as_secs();
    if s < 60 {
        format!("{s}s")
    } else {
        format!("{}m{:02}s", s / 60, s % 60)
    }
}

/// How a grade is colored, or nothing when the output is not a terminal.
///
/// **Loudness follows what the reading FOUND, not how well it went.** `full` means the code
/// read the way its name implied, which is the common case and the least interesting line on
/// the screen, so it is dimmed. `none` means a reader was completely wrong about a function,
/// which is the finding the whole instrument exists to produce — it gets the brightest ink
/// in the run. Coloring these the other way round, as a pass/fail would, makes a wall of
/// green out of the answers nobody needs to read.
fn grade_ink(grade: &str) -> (&'static str, &'static str) {
    if !fancy() {
        return ("", "");
    }
    match grade {
        "full" => ("\x1b[2m", "\x1b[0m"),
        "most" => ("", ""),
        "some" => ("\x1b[33m", "\x1b[0m"),
        "none" => ("\x1b[1;33m", "\x1b[0m"),
        _ => ("\x1b[2m", "\x1b[0m"),
    }
}

/// Print readings as they land, until the run ends.
///
/// **Sanity can do this at all only because it runs the readers.** Progress used to be two
/// counts, because the one party that knew which function was in flight was an agent
/// session narrating into a chat that nothing kept. Every hand-out and every report passes
/// through the backend now, so the terminal and the window can show the same feed without
/// asking a model what it is doing.
///
/// Polls rather than streams. The feed is bounded and carries a sequence number, so a
/// watcher asks "what is newer than what I have" and a missed tick costs nothing; a stream
/// would need the backend to hold a subscriber list for a viewer that can vanish with a
/// Ctrl-C.
pub(super) fn tail(ep: &Endpoint, key: &str, want: &Wanted, banner: &[String]) -> i32 {
    // Copied, because it is replaced when a run follows itself to another backend.
    let mut ep = *ep;
    // Set by the signal handler; read at the top of every poll. A flag rather than
    // stopping from inside the handler because the stop is an HTTP call, and a handler is
    // not the place to make one.
    let interrupted = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    // **Ctrl-X stops WATCHING; Ctrl-C stops the run.** Connecting to a wave somebody else
    // started left no way out that did not also kill it, which turns "let me look" into a
    // decision. Read on a thread in the tiny bit of raw mode that delivers a keystroke
    // without waiting for a newline — signals stay on, so Ctrl-C is unaffected.
    let detached = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let keys = crate::screen::Keys::capture();
    if keys.is_some() {
        watch_detach(detached.clone());
    }
    watch_interrupt(interrupted.clone());
    let mut seen = 0u64;
    let started = Instant::now();
    // Where the run began, so the bar measures THIS run rather than the repo's whole
    // history. A repo that was already 90% read would otherwise open at 90% and creep,
    // which says nothing about the thing you just started.
    let mut banked_at_start: Option<u64> = None;
    // Carried across polls, because the poll that fails is the one that cannot tell you what
    // the run got through — and that is exactly when somebody wants to know.
    let mut done = 0u64;

    // **A fixed block, redrawn in place, and it never grows.** The readings used to stream,
    // so the column header was gone after twenty of them and `most none full yes` was four
    // words in a row. The first fix reserved screen rows with a scroll region, which is
    // defined in ABSOLUTE rows — it pinned the top of the display rather than the header,
    // and the header scrolled off anyway.
    //
    // This keeps the last few readings and rewrites them where they are. Nothing scrolls, so
    // nothing scrolls off, and the escape sequences are two: up N lines, clear a line.
    for line in banner {
        println!("{line}");
    }
    let mut board = Board::new();
    loop {
        if detached.load(std::sync::atomic::Ordering::Relaxed) {
            // Raw mode goes back before anything else prints — see `Keys`' `Drop` — so the
            // summary lands on an ordinary terminal. The block stays where it is: it is the
            // last few readings, and they are worth keeping on screen.
            drop(keys);
            print_detached(want);
            return 0;
        }
        if interrupted.swap(false, std::sync::atomic::Ordering::Relaxed) {
            println!();
            println!("Stopping readers…");
            let _ = post(&ep, "/stop", json!({ "project": key }));
            // Kept tailing rather than returning: the readers take a moment to die, and
            // the run's own summary is the honest answer to "what did I just spend".
        }
        let Ok(st) = get(&ep, &format!("/status?project={}", urlencode(key))) else {
            if let Some(next) = follow_takeover(&ep, want, &mut board) {
                ep = next;
                continue;
            }
            // Nothing is serving, or the new backend refused. Reported as the RUN ending,
            // because that is the only part anybody has a stake in.
            board.erase();
            drop(keys);
            print_stopped_early(done, started);
            return 1;
        };
        for row in fresh_readings(&st, &mut seen) {
            board.add(row);
        }

        let run = st.get("run").cloned().unwrap_or(Value::Null);
        let assessed = num(&st, "assessed");
        let remaining = num(&st, "remaining");
        let from = *banked_at_start.get_or_insert(assessed);
        done = assessed.saturating_sub(from);
        let target = done + remaining;

        if run.get("running").and_then(|v| v.as_bool()) == Some(false) {
            board.erase();
            drop(keys);
            print_ended(&st, &run, done, started);
            return 0;
        }
        board.draw(done, target, &run, started);
        std::thread::sleep(Duration::from_secs(2));
    }
}

/// Set `flag` the moment Ctrl-X arrives on stdin, from a thread of its own.
///
/// Only once raw mode is on — see `Keys::capture` — since without it the byte would wait
/// behind a newline nobody types.
fn watch_detach(flag: std::sync::Arc<std::sync::atomic::AtomicBool>) {
    std::thread::spawn(move || {
        use std::io::Read;
        let mut byte = [0u8; 1];
        while std::io::stdin().read_exact(&mut byte).is_ok() {
            if byte[0] == 0x18 {
                flag.store(true, std::sync::atomic::Ordering::Relaxed);
                return;
            }
        }
    });
}

/// Set `flag` on Ctrl-C, from a thread of its own, leaving the stop itself to the poll.
fn watch_interrupt(flag: std::sync::Arc<std::sync::atomic::AtomicBool>) {
    // Tokio's handler rather than a new dependency; a current-thread runtime on its
    // own thread is enough to own it, and the tail itself stays blocking.
    std::thread::spawn(move || {
        if let Ok(rt) = tokio::runtime::Builder::new_current_thread().enable_all().build() {
            rt.block_on(async {
                if tokio::signal::ctrl_c().await.is_ok() {
                    flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            });
        }
    });
}

/// Width of the name column, so the leaders end where the grades begin.
const NAME_COL: usize = 38;
/// Width of each grade column. Ten, not eight, because `predicted` and `derivable` are
/// nine characters — a heading wider than its own column pushes every column right of
/// it out of line with the rows beneath, which is what the header was doing.
const GRADE_COL: usize = 10;
/// How many readings stay on screen. Enough to see a run working and to catch a
/// surprising grade going past; few enough that the block fits any terminal worth
/// running this in.
const KEEP: usize = 10;

/// What the tail has on screen below the banner: the column header, the last few readings
/// and the progress line, and what it takes to rewrite them in place.
struct Board {
    header: String,
    header_drawn: bool,
    recent: std::collections::VecDeque<String>,
    // Whether a status line is currently on screen and needs erasing before anything else
    // prints. Tracked rather than assumed: the first pass has drawn nothing yet, and
    // erasing a line that is not there eats the line above it.
    drawn: bool,
    // Rows this loop has drawn and will overwrite next time: the readings plus the progress
    // line. Zero until the first draw, because moving up over rows nobody wrote eats the
    // banner.
    block: usize,
}

impl Board {
    /// Nothing on screen yet, and a header ready for the first reading.
    fn new() -> Board {
        Board {
            header: reading_header(),
            header_drawn: false,
            recent: std::collections::VecDeque::new(),
            drawn: false,
            block: 0,
        }
    }

    /// Clear the progress line the cursor is sitting on, if one is drawn.
    fn erase(&mut self) {
        if self.drawn {
            print!("\r\x1b[K");
            self.drawn = false;
        }
    }

    /// One reading row: printed as it lands in a log, kept for the next redraw on a terminal.
    fn add(&mut self, row: String) {
        // A log gets every reading, in order, as it lands. A terminal gets the last
        // few, rewritten in place — the same information, with the header still
        // above it.
        // The header arrives with the row it labels. In a terminal the progress line
        // is already on screen and the cursor is sitting on it, so it is erased first
        // — printing over it would leave its tail beside the headings. `block` is
        // still zero here (nothing has been drawn above the progress line yet), so
        // the next redraw starts below the header and leaves it alone.
        if !self.header_drawn {
            if fancy() {
                self.erase();
            }
            println!("{}", self.header);
            self.header_drawn = true;
        }
        if fancy() {
            self.recent.push_back(row);
            while self.recent.len() > KEEP {
                self.recent.pop_front();
            }
        } else {
            println!("{row}");
        }
    }

    /// **The whole block, rewritten where it is.** Only where there is a terminal: in a
    /// log or a pipe this would be a carriage return every two seconds and nothing
    /// legible at the end, so a non-terminal gets the readings as they land and no chrome
    /// at all.
    fn draw(&mut self, done: u64, target: u64, run: &Value, started: Instant) {
        if !fancy() {
            return;
        }
        let frac = if target == 0 { 0.0 } else { done as f64 / target as f64 };
        // **Live AND spawned, because the two answer different questions and the line
        // used to answer only one.** `live` is the concurrency somebody chose in the
        // dialog and does not move; what climbs is how many readers have been out, since
        // each takes a batch and exits. The window's panel shows `spawned` in the same
        // visual slot, so a line saying "5 readers" beside a panel saying "30 started"
        // read as two counts of one thing disagreeing.
        let readers = num(run, "live");
        let spawned = num(run, "spawned");
        let mut out = String::new();
        // Back to the top of what was drawn last time. Relative, so it does not care
        // where on the screen it is — the mistake the scroll region made.
        //
        // **Up by the ROWS ABOVE the cursor, not by the rows drawn.** The last thing
        // written is the progress line, with no newline after it, so the cursor is
        // sitting on it: the block is `rows + 1` lines tall but only `rows` of them are
        // above. Moving up the full height overshot into the banner and left the old
        // progress line untouched below — the banner was eaten one line per poll while
        // the progress lines stacked up.
        out.push('\r');
        if self.block > 0 {
            out.push_str(&format!("\x1b[{}A", self.block));
        }
        for row in &self.recent {
            out.push_str("\r\x1b[K");
            out.push_str(row);
            out.push('\n');
        }
        out.push_str(&format!(
            "\r\x1b[K\x1b[2m▕\x1b[0m{}\x1b[2m▏\x1b[0m {}/{} · {} of {} · {}",
            bar(frac),
            commas(done),
            commas(target),
            commas(readers),
            plural(spawned, "reader"),
            elapsed(started),
        ));
        print!("{out}");
        let _ = std::io::Write::flush(&mut std::io::stdout());
        // What is ABOVE the cursor now: the readings. The progress line is the one the
        // cursor is on, so it is cleared by the `\r\x1b[K` at the start rather than
        // counted here.
        self.block = self.recent.len();
        self.drawn = true;
    }
}

/// The column headings over the readings, dimmed on a terminal.
///
/// **Held until the first reading lands.** A wave takes minutes to bank anything, and a
/// run that banks nothing at all — a misconfigured harness, a repo somebody has already
/// read — leaves four headings floating over an empty table with a progress bar under
/// them. Headings label rows; with no rows they are decoration that looks like a fault.
fn reading_header() -> String {
    if fancy() {
        let (d, o) = ("\x1b[2m", "\x1b[0m");
        format!(
            "  {d}{:<NAME$} {:<G$}{:<G$}{:<G$}derivable{o}",
            "function",
            "predicted",
            "doc'd",
            "legible",
            NAME = NAME_COL,
            G = GRADE_COL,
        )
    } else {
        format!(
            "  {:<NAME$} {:<G$}{:<G$}{:<G$}derivable",
            "function",
            "predicted",
            "doc'd",
            "legible",
            NAME = NAME_COL,
            G = GRADE_COL,
        )
    }
}

/// The readings in a status poll that have not been shown yet, as rows, moving `seen` past
/// every event the poll carried.
fn fresh_readings(st: &Value, seen: &mut u64) -> Vec<String> {
    let mut rows = Vec::new();
    let Some(events) = st.get("events").and_then(|v| v.as_array()) else {
        return rows;
    };
    for e in events {
        let seq = e.get("seq").and_then(|v| v.as_u64()).unwrap_or(0);
        if seq <= *seen {
            continue;
        }
        *seen = seq;
        // Only readings. Hand-outs churn several a second during a wave and would
        // bury the results they precede.
        if e.get("stage").and_then(|v| v.as_str()) != Some("read") {
            continue;
        }
        rows.push(reading_row(e));
    }
    rows
}

/// One reading as a row under the header: the name with its leader, then the four grades.
fn reading_row(e: &Value) -> String {
    let grade = text(e, "predicted");
    let (ink, off) = grade_ink(grade);
    let name = text(e, "name");
    let shown: String = name.chars().take(NAME_COL).collect();
    let dots = NAME_COL - shown.chars().count();
    let leader = if fancy() {
        format!("\x1b[2m{}\x1b[0m", "·".repeat(dots))
    } else {
        " ".repeat(dots)
    };
    format!(
        "  {shown}{leader} {ink}{:<G$}{off}{:<G$}{:<G$}{}",
        grade,
        text(e, "documented"),
        // Absent when the grade was taken under a superseded question — see
        // `Event::legible`. A dash, not a blank: the column still exists.
        match text(e, "legible") {
            "" => "—",
            g => g,
        },
        match e.get("derivable").and_then(|v| v.as_bool()) {
            Some(true) => "yes",
            Some(false) => "no",
            None => "—",
        },
        G = GRADE_COL,
    )
}

/// The backend that replaced the one this run was living in, with the run reissued on it,
/// or `None` when nothing new is serving or it refused.
///
/// **Opening the app kills the daemon this run was living in**, by design: one backend per
/// machine, and a human at the window beats a background process. The run went with it, and
/// the only way to continue was to notice and retype the command — which is what happened,
/// and is not a thing a tool should ask of somebody watching a progress bar.
///
/// So: look for whoever is serving now, and reissue. Bounded and single-shot, because a loop
/// that keeps re-starting waves against a backend that keeps dying is a worse failure than
/// stopping.
fn follow_takeover(ep: &Endpoint, want: &Wanted, board: &mut Board) -> Option<Endpoint> {
    let next = await_backend(Instant::now() + START_WAIT)?;
    if next.pid == ep.pid {
        return None;
    }
    board.erase();
    println!();
    println!("The app took over. Continuing there.");
    println!();
    resume(&next, want).ok().map(|()| next)
}

/// What Ctrl-X leaves on screen: that the run goes on, and how to look in on it.
fn print_detached(want: &Wanted) {
    println!();
    println!();
    println!("Detached. The run continues.");
    println!("  `sanity status {}` says how far along it is.", want.repo.display());
    println!();
}

/// What a tail that lost its backend for good says: the run is over, and what it banked.
///
/// It said "lost the backend … the run may still be going", which asks somebody to hold a
/// lifecycle in their head: backends are ephemeral, there is only ever one, the next command
/// starts another and so does opening the window. None of that is a fact worth teaching at
/// the moment a run stops.
///
/// What IS true and useful: every reading is written to `.sanity/` as it lands, so what was
/// banked is safe and the only loss is whatever was in flight.
fn print_stopped_early(done: u64, started: Instant) {
    println!();
    println!("The run stopped early.");
    println!();
    println!("  {} in {}", plural(done, "reading"), elapsed(started));
    println!("  `sanity check` picks up where it left off.");
    println!();
}

/// The summary of a run that ended on the backend's side: why, then what it did.
fn print_ended(st: &Value, run: &Value, done: u64, started: Instant) {
    let failed = num(run, "failed");
    println!();
    // Why it ended, then what it did. The first line is the backend's own sentence,
    // printed bare — "Stopped at your request.", "Reached the limit of 10 readings."
    // — and the rest is the answer to "what did I just spend", which is the whole
    // reason an interrupted run keeps tailing instead of returning at the keystroke.
    println!("{}", text(run, "ended"));
    println!();
    println!("  {} in {}", plural(done, "reading"), elapsed(started));
    // Named rather than folded into the total. A misconfigured agent exits
    // instantly, so a run that banked nothing looks merely disappointing until you
    // see that every reader failed.
    if failed > 0 {
        println!("  {} failed", plural(failed, "reader"));
    }
    println!(
        "  {} of {} read, {} to go",
        commas(num(st, "assessed")),
        commas(num(st, "functions") + num(st, "files")),
        commas(num(st, "remaining")),
    );
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The pieces of the progress line, which is watched for minutes and has to be right.
    #[test]
    fn the_progress_line_reads_correctly_at_both_ends() {
        assert_eq!(bar(0.0).chars().filter(|c| *c == '█').count(), 0);
        assert_eq!(bar(1.0).chars().filter(|c| *c == '░').count(), 0);
        // Always the same width, whatever the fraction — a bar that grows the line it is on
        // makes the counts beside it jump about while somebody is reading them.
        for f in [0.0, 0.01, 0.5, 0.999, 1.0] {
            assert_eq!(bar(f).chars().count(), BAR);
        }
        // Out of range rather than panicking: `done` comes from one poll and `target` from
        // another, so a reading landing between them can put this over 1.
        assert_eq!(bar(1.4).chars().count(), BAR);

        assert_eq!(plural(1, "reader"), "1 reader");
        assert_eq!(plural(0, "reader"), "0 readers");
        assert_eq!(plural(5, "reader"), "5 readers");
    }
}
