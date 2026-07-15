"use client";

import { useFormStatus } from "react-dom";
import { createDraftStory } from "@/lib/actions/stories";
import { Button, Input } from "@/components/ui";

function ContinueButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Continue
    </Button>
  );
}

/**
 * Step 1 of the creator flow. One question, one field, one action — the title
 * becomes a draft story and moves the teller to the recording screen.
 */
export function TitleForm() {
  return (
    <form action={createDraftStory} className="flex w-full flex-col gap-8">
      <Input
        name="title"
        serif
        autoFocus
        aria-label="Story title"
        placeholder="The day my daughter was born"
        hint="You can change this later."
      />
      <ContinueButton />
    </form>
  );
}
