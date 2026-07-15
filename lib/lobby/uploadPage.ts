import { PAGES_UPLOAD_BUCKET, requireSupabase } from "@/lib/supabase";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = new Set(["image/png", "image/jpeg"]);

export function validateUploadFile(file: File): string | null {
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    return "Please choose a PNG or JPG image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "Image must be 5 MB or smaller.";
  }
  return null;
}

/**
 * Upload a creator's line-art image to Storage. Returns the public URL stored on
 * the lobby's `page_image` field so both players load the same file.
 */
export async function uploadColoringPage(
  lobbyId: string,
  file: File
): Promise<string> {
  const err = validateUploadFile(file);
  if (err) throw new Error(err);

  const supabase = requireSupabase();
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${lobbyId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(PAGES_UPLOAD_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from(PAGES_UPLOAD_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
