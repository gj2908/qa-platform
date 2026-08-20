// Shared by TaskDetailDialog.js's write path (which collaborators does a
// comment @mention) and render path (highlighting those mentions) so the
// two never drift apart on what counts as a mention.

export function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Detects an in-progress "@query" immediately before the caret, for
// driving the autocomplete dropdown as the user types.
export function getMentionQueryAt(text, caret) {
  const uptoCaret = text.slice(0, caret);
  const m = uptoCaret.match(/(?:^|\s)@([^\s@]*)$/);
  return m ? { query: m[1], start: caret - m[1].length - 1 } : null;
}

// A mention requires an explicit "@" immediately before the collaborator's
// email — a bare substring match (an email mentioned in passing prose)
// doesn't count.
export function extractMentionedCollaborators(body, collaborators, selfEmail) {
  return collaborators.filter((c) => c.email !== selfEmail && body.includes(`@${c.email}`));
}

// Splits a comment body into text/mention segments for render-time
// highlighting, using the same known-collaborator list as the write path.
export function splitMentions(body, collaborators) {
  const emails = collaborators.map((c) => c.email).filter((e) => body.includes(`@${e}`));
  if (emails.length === 0) return [{ type: "text", value: body }];

  const alternation = emails.map((e) => escapeRegExp(`@${e}`)).join("|");
  const re = new RegExp(`(${alternation})`, "g");
  return body
    .split(re)
    .filter((part) => part !== "")
    .map((part) => {
      const email = part.startsWith("@") ? part.slice(1) : null;
      const match = email ? collaborators.find((c) => c.email === email) : null;
      return match ? { type: "mention", value: part, email: match.email } : { type: "text", value: part };
    });
}
