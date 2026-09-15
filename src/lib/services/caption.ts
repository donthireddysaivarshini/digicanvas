import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

/**
 * Service to manage content captions with transactional versioning.
 * Invariant: Content.caption is always equal to the latest CaptionVersion.caption.
 */
export async function updateContentCaptionWithVersion(
  contentId: string,
  newCaption: string,
  editedById: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch content and verify existence
    const content = await tx.content.findUnique({
      where: { id: contentId },
      include: {
        captionVersions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!content) {
      throw new NotFoundError(`Content with ID ${contentId} not found.`);
    }

    // Determine the next version number
    const currentLatestVersion = content.captionVersions[0]?.versionNumber ?? 0;
    const nextVersionNumber = currentLatestVersion + 1;

    // 2. Create the historical CaptionVersion record
    const captionVersion = await tx.captionVersion.create({
      data: {
        contentId,
        versionNumber: nextVersionNumber,
        caption: newCaption,
        editedById,
      },
    });

    // 3. Update the primary Content.caption to match the latest version
    const updatedContent = await tx.content.update({
      where: { id: contentId },
      data: {
        caption: newCaption,
        updatedById: editedById,
      },
    });

    return {
      content: updatedContent,
      version: captionVersion,
    };
  });
}
