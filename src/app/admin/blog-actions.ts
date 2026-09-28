"use server";

import { revalidatePath } from "next/cache";
import { requireSiteAdmin } from "@/server/auth";
import { deletePost, savePost, setPostStatus, type PostInput } from "@/server/blog";

// Blog in the site admin: each article is saved and published on its own (not with the site draft).

const refresh = () => {
  revalidatePath("/", "layout");
  revalidatePath("/admin");
};

export async function saveBlogPost(input: PostInput) {
  const user = await requireSiteAdmin();
  const res = await savePost(input, user.name);
  if (res.ok) refresh();
  return res;
}

export async function publishBlogPost(id: string, publish: boolean) {
  await requireSiteAdmin();
  const res = await setPostStatus(String(id), publish ? "PUBLISHED" : "DRAFT");
  if (res.ok) refresh();
  return res;
}

export async function deleteBlogPost(id: string) {
  await requireSiteAdmin();
  const res = await deletePost(String(id));
  refresh();
  return res;
}
