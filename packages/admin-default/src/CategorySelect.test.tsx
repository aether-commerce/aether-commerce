// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "./test-render";
import { CategorySelect, type CategorySelectOption } from "./CategorySelect";

const labels = {
  placeholder: "Select a category",
  search: "Search categories",
  loading: "Loading categories...",
  error: "Could not load categories.",
  empty: "No categories are available yet.",
  noResults: "No categories match that search.",
  retry: "Retry"
};

const options: CategorySelectOption[] = [
  { id: "cat_audio", slug: "audio", name: "Audio", isHidden: false },
  { id: "cat_books", slug: "books", name: "Books", isHidden: false }
];

describe("CategorySelect", () => {
  it("closes the listbox and restores focus after selecting a category", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <CategorySelect
        value=""
        options={options}
        loading={false}
        error={false}
        onOpen={vi.fn()}
        onRetry={vi.fn()}
        onValueChange={onValueChange}
        labels={labels}
      />
    );

    const trigger = screen.getByRole("button", { name: labels.placeholder });
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: /Audio audio/ }));

    expect(onValueChange).toHaveBeenCalledWith("audio");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });
});
