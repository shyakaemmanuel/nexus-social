import { cloudinaryConfig } from './firebase';

// Upload file to Cloudinary (unsigned upload)
export async function uploadToCloudinary(
  file: File,
  folder: string = 'nexus-social',
  uploadPreset: string = cloudinaryConfig.uploadPreset
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);

    const cloudName = cloudinaryConfig.cloudName;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

    fetch(url, {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve(data.secure_url);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// Upload video to Cloudinary
export async function uploadVideoToCloudinary(
  file: File,
  folder: string = 'nexus-social',
  uploadPreset: string = cloudinaryConfig.uploadPreset
): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    formData.append('folder', folder);
    formData.append('resource_type', 'video');

    const cloudName = cloudinaryConfig.cloudName;
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

    fetch(url, {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.error) {
          reject(new Error(data.error.message));
        } else {
          resolve(data.secure_url);
        }
      })
      .catch((error) => {
        reject(error);
      });
  });
}

// Auto-detect file type and upload accordingly
export async function uploadMediaToCloudinary(
  file: File,
  folder: string = 'nexus-social'
): Promise<string> {
  if (file.type.startsWith('video/')) {
    return uploadVideoToCloudinary(file, folder);
  } else if (file.type.startsWith('image/')) {
    return uploadToCloudinary(file, folder);
  } else {
    throw new Error('Unsupported file type. Only images and videos are allowed.');
  }
}
