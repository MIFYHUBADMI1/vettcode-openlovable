import ImageKit from 'imagekit';

if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY || !process.env.IMAGEKIT_URL_ENDPOINT) {
  throw new Error('Please add your ImageKit credentials to .env.local');
}

// ImageKit instance for server-side operations
export const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// Helper function to upload a file
export async function uploadFile(file: Buffer | string, fileName: string, folder: string = '/') {
  try {
    const result = await imagekit.upload({
      file,
      fileName,
      folder,
    });
    return result;
  } catch (error) {
    console.error('ImageKit upload error:', error);
    throw error;
  }
}

// Helper function to delete a file
export async function deleteFile(fileId: string) {
  try {
    await imagekit.deleteFile(fileId);
    return { success: true };
  } catch (error) {
    console.error('ImageKit delete error:', error);
    throw error;
  }
}

// Helper function to get file details
export async function getFileDetails(fileId: string) {
  try {
    const result = await imagekit.getFileDetails(fileId);
    return result;
  } catch (error) {
    console.error('ImageKit get file error:', error);
    throw error;
  }
}
