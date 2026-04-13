"use server";

import { redirect } from "next/navigation";
import { createCandidate } from "@/actions/candidates";
import { deleteVacancy } from "@/actions/vacancies";

export async function addCandidateForVacancy(vacancyId: string, formData: FormData) {
  await createCandidate(vacancyId, formData);
}

export async function removeVacancyAndRedirect(vacancyId: string) {
  await deleteVacancy(vacancyId);
  redirect("/dashboard");
}
