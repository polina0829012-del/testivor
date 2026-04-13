"use server";

import {
  addPlanBlock,
  addQuestion,
  deletePlanBlock,
  deleteQuestion,
  saveInterviewPlanContent,
  toggleBlockRequired,
  updatePlanBlockTitle,
  updateQuestionText,
} from "@/actions/plan";
import { updateVacancyMeta } from "@/actions/vacancies";

export async function submitVacancyMeta(vacancyId: string, formData: FormData): Promise<void> {
  await updateVacancyMeta(vacancyId, formData);
}

export async function submitSaveInterviewPlan(vacancyId: string, formData: FormData): Promise<void> {
  await saveInterviewPlanContent(vacancyId, formData);
}

export async function submitBlockTitle(formData: FormData): Promise<void> {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const title = String(formData.get("title") ?? "");
  await updatePlanBlockTitle(blockId, vacancyId, title);
}

export async function submitQuestionText(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const text = String(formData.get("text") ?? "");
  await updateQuestionText(questionId, vacancyId, text);
}

export async function submitToggleRequired(formData: FormData): Promise<void> {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  await toggleBlockRequired(blockId, vacancyId);
}

export async function submitAddBlock(formData: FormData): Promise<void> {
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const title = String(formData.get("title") ?? "Новый блок");
  await addPlanBlock(vacancyId, title);
}

export async function submitDeleteBlock(formData: FormData): Promise<void> {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  await deletePlanBlock(blockId, vacancyId);
}

export async function submitAddQuestion(formData: FormData): Promise<void> {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  await addQuestion(blockId, vacancyId);
}

export async function submitDeleteQuestion(formData: FormData): Promise<void> {
  const questionId = String(formData.get("questionId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  await deleteQuestion(questionId, vacancyId);
}
