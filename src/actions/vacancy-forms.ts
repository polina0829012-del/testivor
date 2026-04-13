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

export async function submitVacancyMeta(vacancyId: string, formData: FormData) {
  return updateVacancyMeta(vacancyId, formData);
}

export async function submitSaveInterviewPlan(vacancyId: string, formData: FormData) {
  return saveInterviewPlanContent(vacancyId, formData);
}

export async function submitBlockTitle(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const title = String(formData.get("title") ?? "");
  return updatePlanBlockTitle(blockId, vacancyId, title);
}

export async function submitQuestionText(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const text = String(formData.get("text") ?? "");
  return updateQuestionText(questionId, vacancyId, text);
}

export async function submitToggleRequired(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  return toggleBlockRequired(blockId, vacancyId);
}

export async function submitAddBlock(formData: FormData) {
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const title = String(formData.get("title") ?? "Новый блок");
  return addPlanBlock(vacancyId, title);
}

export async function submitDeleteBlock(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  return deletePlanBlock(blockId, vacancyId);
}

export async function submitAddQuestion(formData: FormData) {
  const blockId = String(formData.get("blockId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  return addQuestion(blockId, vacancyId);
}

export async function submitDeleteQuestion(formData: FormData) {
  const questionId = String(formData.get("questionId") ?? "");
  const vacancyId = String(formData.get("vacancyId") ?? "");
  return deleteQuestion(questionId, vacancyId);
}
