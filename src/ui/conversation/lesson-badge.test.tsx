import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LessonBadge } from "./LessonBadge";

describe("lesson badge: teaching is visible", () => {
  it("first time: Teaching you", () => {
    render(<LessonBadge lesson={{ skill: "connect to wifi", stage: "new" }} />);
    expect(screen.getByText("Teaching you: Connect to wifi")).toBeInTheDocument();
  });
  it("done before: try it yourself", () => {
    render(<LessonBadge lesson={{ skill: "connect to wifi", stage: "practice" }} />);
    expect(screen.getByText("You've done this before: try it yourself")).toBeInTheDocument();
  });
  it("finished: learned, and what happens next time", () => {
    render(<LessonBadge lesson={{ skill: "connect to wifi", stage: "learned" }} />);
    expect(screen.getByText("Learned: Connect to wifi")).toBeInTheDocument();
    expect(screen.getByText(/Next time I'll let you try first/)).toBeInTheDocument();
  });
});
