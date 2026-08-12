// A ~30-line parser for the small markdown subset CHANGELOG.md
// deliberately stays within (#/## headers, "- " bullets, `code` spans,
// plain paragraphs) — that file is authored by us, so it can commit to
// a known subset instead of pulling in a full markdown dependency.
function renderInline(text, keyPrefix) {
  return text.split(/(`[^`]+`)/g).map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={`${keyPrefix}-${i}`} className="rounded bg-subtle px-1 py-0.5 text-[0.9em] text-ink-primary">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function parseBlocks(markdown) {
  const lines = markdown.split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ type: "h2", text: line.slice(3).trim() });
      i++;
    } else if (line.startsWith("# ")) {
      blocks.push({ type: "h1", text: line.slice(2).trim() });
      i++;
    } else if (line.startsWith("- ")) {
      const items = [];
      while (i < lines.length) {
        if (lines[i].startsWith("- ")) {
          items.push(lines[i].slice(2).trim());
          i++;
        } else if (lines[i].trim() && !lines[i].startsWith("#")) {
          items[items.length - 1] += ` ${lines[i].trim()}`;
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "ul", items });
    } else {
      const paraLines = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("- ")) {
        paraLines.push(lines[i].trim());
        i++;
      }
      blocks.push({ type: "p", text: paraLines.join(" ") });
    }
  }
  return blocks;
}

export default function ChangelogContent({ markdown }) {
  return parseBlocks(markdown).map((block, idx) => {
    const key = `block-${idx}`;
    if (block.type === "h1") {
      return (
        <h1 key={key} className="text-2xl font-semibold text-ink-primary">
          {renderInline(block.text, key)}
        </h1>
      );
    }
    if (block.type === "h2") {
      return (
        <h2 key={key} className="mt-8 text-base font-semibold text-ink-primary first:mt-0">
          {renderInline(block.text, key)}
        </h2>
      );
    }
    if (block.type === "ul") {
      return (
        <ul key={key} className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-ink-secondary">
          {block.items.map((item, i) => (
            <li key={`${key}-${i}`} className="flex gap-2">
              <span className="shrink-0 text-ink-tertiary">–</span>
              <span>{renderInline(item, `${key}-${i}`)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <p key={key} className="mt-2 text-sm leading-relaxed text-ink-secondary">
        {renderInline(block.text, key)}
      </p>
    );
  });
}
