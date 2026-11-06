import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { axeViolations } from "@/test/axe";

import { Checkbox } from "./checkbox";
import { FormField } from "./form-field";
import { Input } from "./input";
import { Textarea } from "./textarea";

describe("FormField", () => {
  it("associates the label with the control", () => {
    render(
      <FormField label="Adresse e-mail">
        <Input type="email" />
      </FormField>,
    );
    expect(screen.getByLabelText("Adresse e-mail")).toHaveAttribute("type", "email");
  });

  it("links the description and marks required fields", () => {
    render(
      <FormField label="Entreprise" description="Raison sociale" required requiredLabel="obligatoire">
        <Input />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: /Entreprise/ });

    expect(input).toHaveAccessibleDescription("Raison sociale");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText("obligatoire")).toHaveClass("sr-only");
  });

  it("exposes the error to assistive technologies", () => {
    render(
      <FormField label="Message" description="1000 caractères maximum" error="Le message est requis.">
        <Textarea />
      </FormField>,
    );
    const textarea = screen.getByRole("textbox", { name: "Message" });

    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("1000 caractères maximum Le message est requis.");
    expect(screen.getByRole("alert")).toHaveTextContent("Le message est requis.");
  });

  it("toggles an inline checkbox by clicking its label", async () => {
    render(
      <FormField label="J'accepte la politique de confidentialité" inline>
        <Checkbox />
      </FormField>,
    );
    const checkbox = screen.getByRole("checkbox", {
      name: "J'accepte la politique de confidentialité",
    });

    expect(checkbox).not.toBeChecked();
    await userEvent.click(screen.getByText("J'accepte la politique de confidentialité"));
    expect(checkbox).toBeChecked();
  });

  it("has no accessibility violations, with and without errors", async () => {
    const { container } = render(
      <form>
        <FormField label="Nom" required requiredLabel="obligatoire">
          <Input autoComplete="name" />
        </FormField>
        <FormField label="E-mail" error="Adresse invalide.">
          <Input type="email" autoComplete="email" />
        </FormField>
        <FormField label="Message">
          <Textarea />
        </FormField>
        <FormField label="Recevoir la newsletter" inline>
          <Checkbox />
        </FormField>
      </form>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
