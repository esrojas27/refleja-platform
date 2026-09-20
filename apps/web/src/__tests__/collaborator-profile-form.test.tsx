import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CollaboratorProfileForm } from "@/components/auth/collaborator-profile-form";
import { completeCollaboratorProfile, getCollaboratorProfile, type CollaboratorProfile } from "@/lib/auth/profile-api";

vi.mock("@/lib/auth/profile-api", async original => ({
  ...await original<typeof import("@/lib/auth/profile-api")>(),
  getCollaboratorProfile: vi.fn(), completeCollaboratorProfile: vi.fn(),
}));

const pending: CollaboratorProfile = { organizationId: "org-a", company: "Empresa A", email: "ana@example.test",
  fullName: "Ana Prueba", dateOfBirth: null, phone: null, city: null, country: null, jobTitle: null, status: "PENDING" };

beforeEach(() => {
  vi.mocked(getCollaboratorProfile).mockResolvedValue(pending);
  vi.mocked(completeCollaboratorProfile).mockResolvedValue({ ...pending, dateOfBirth: "1990-05-12",
    phone: "+57 300 123 4567", city: "Bogotá", country: "Colombia", jobTitle: "Analista", status: "COMPLETE" });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("shows server-derived email and company without asking the collaborator to edit them", async () => {
  render(<CollaboratorProfileForm organizationId="org-a" />);
  expect(await screen.findByDisplayValue("Ana Prueba")).toBeTruthy();
  expect(screen.getByText("ana@example.test")).toBeTruthy();
  expect(screen.getByText("Empresa A")).toBeTruthy();
  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.queryByLabelText("Empresa")).toBeNull();
  expect(screen.getByText("Perfil pendiente")).toBeTruthy();
});

it("completes every required editable field and unlocks the programs link", async () => {
  render(<CollaboratorProfileForm organizationId="org-a" />);
  await screen.findByDisplayValue("Ana Prueba");
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"), { target: { value: "1990-05-12" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+57 300 123 4567" } });
  fireEvent.change(screen.getByLabelText("Ciudad"), { target: { value: " Bogotá " } });
  fireEvent.change(screen.getByLabelText("País"), { target: { value: " Colombia " } });
  fireEvent.change(screen.getByLabelText("Cargo"), { target: { value: " Analista " } });
  fireEvent.click(screen.getByRole("button", { name: "Completar perfil" }));
  await waitFor(() => expect(completeCollaboratorProfile).toHaveBeenCalledWith("org-a", {
    fullName: "Ana Prueba", dateOfBirth: "1990-05-12", phone: "+57 300 123 4567",
    city: "Bogotá", country: "Colombia", jobTitle: "Analista",
  }, expect.any(AbortSignal)));
  expect(await screen.findByText("Perfil completo")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Ir a mis programas" }).getAttribute("href")).toBe("/my-programs");
});
