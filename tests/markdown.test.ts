import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/content/Markdown";

const render = (md: string) => renderToStaticMarkup(createElement(Markdown, null, md));

describe("markdown rendering is XSS-safe", () => {
  it("never emits raw HTML/script/handlers", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<iframe src="https://evil"></iframe>');
    expect(html).not.toMatch(/<script|<img|<iframe|onerror/i);
  });
  it("strips javascript:/data: links but keeps safe ones", () => {
    const html = render("[a](javascript:alert(1)) [b](data:text/html,x) [c](https://ok.example) [d](/about) [e](mailto:a@b.co)");
    expect(html).not.toMatch(/javascript:|data:text/i);
    expect(html).toContain('href="https://ok.example"'); expect(html).toContain('href="/about"'); expect(html).toContain("mailto:a@b.co");
  });
  it("external links open safely", () => {
    expect(render("[x](https://ok.example)")).toContain('rel="noopener noreferrer"');
  });
  it("renders normal markdown", () => {
    const html = render("## Title\n\n- one\n- two\n\n**bold**");
    expect(html).toContain("<h2"); expect(html).toContain("<li"); expect(html).toContain("<strong>bold</strong>");
  });
});
