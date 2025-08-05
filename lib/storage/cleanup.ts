import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

/**
 * Extracts the storage path from a Supabase storage URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/co-attachments/project-id/file.pdf
 * Returns: co-attachments/project-id/file.pdf
 */
function extractStoragePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl)
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/(.+)/)
    return pathMatch ? pathMatch[1] : null
  } catch {
    return null
  }
}

/**
 * Deletes files from Supabase storage
 * @param supabase - Supabase client with storage permissions
 * @param fileUrls - Array of file URLs to delete
 * @param bucketName - Storage bucket name (defaults to 'co-attachments')
 * @returns Object with success count and errors
 */
export async function deleteStorageFiles(
  supabase: SupabaseClient<Database>,
  fileUrls: string[],
  bucketName: string = 'co-attachments'
): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] }
  
  if (fileUrls.length === 0) return result

  // Extract storage paths from URLs
  const paths: string[] = []
  for (const url of fileUrls) {
    const path = extractStoragePath(url)
    if (path) {
      // Remove bucket name from path if present
      const cleanPath = path.startsWith(`${bucketName}/`) 
        ? path.substring(bucketName.length + 1)
        : path
      paths.push(cleanPath)
    } else {
      result.errors.push(`Invalid storage URL: ${url}`)
    }
  }

  if (paths.length === 0) return result

  try {
    // Delete files in batches to avoid overwhelming the API
    const batchSize = 100
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize)
      
      const { data, error } = await supabase.storage
        .from(bucketName)
        .remove(batch)

      if (error) {
        result.errors.push(`Storage deletion error: ${error.message}`)
      } else if (data) {
        result.deleted += data.length
      }
    }
  } catch (error) {
    result.errors.push(
      `Unexpected storage error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return result
}

/**
 * Deletes all files in a specific project folder
 * @param supabase - Supabase client with storage permissions
 * @param projectId - Project ID to delete files for
 * @param bucketName - Storage bucket name (defaults to 'co-attachments')
 */
export async function deleteProjectStorageFolder(
  supabase: SupabaseClient<Database>,
  projectId: string,
  bucketName: string = 'co-attachments'
): Promise<{ deleted: number; errors: string[] }> {
  const result = { deleted: 0, errors: [] as string[] }

  try {
    // List all files in the project folder
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list(projectId, {
        limit: 1000,
        offset: 0
      })

    if (listError) {
      result.errors.push(`Failed to list files: ${listError.message}`)
      return result
    }

    if (!files || files.length === 0) {
      return result
    }

    // Prepare file paths for deletion
    const filePaths = files.map(file => `${projectId}/${file.name}`)

    // Delete the files
    const { data, error: deleteError } = await supabase.storage
      .from(bucketName)
      .remove(filePaths)

    if (deleteError) {
      result.errors.push(`Failed to delete files: ${deleteError.message}`)
    } else if (data) {
      result.deleted = data.length
    }

  } catch (error) {
    result.errors.push(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return result
}