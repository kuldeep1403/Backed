import { v2 as cloudinary } from "cloudinary";
import fs from "fs/promises";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const removeLocalFile = async (path) => {
  if (!path) return;
  try {
    await fs.unlink(path);
  } catch (err) {
    console.error("Failed to remove file:", path, err);
  }
};

const uploadOnCloudinary = async (localFilePath, folder = "uploads") => {
  if (!localFilePath) return null;

  try {
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder,
      secure: true,
    });

    await removeLocalFile(localFilePath);

    console.log("Uploaded to Cloudinary:", response);

    return response;
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    await removeLocalFile(localFilePath);
    return null;
  }
};

const deleteOnCloudinary = async (public_id) => {
  if (!public_id) return null;

  try {
    const result = await cloudinary.uploader.destroy(public_id);
    console.log("Deleted from Cloudinary:", result);
    return result;
  } catch (error) {
    console.error("Cloudinary delete failed:", error);
    return null;
  }
};

export { uploadOnCloudinary, deleteOnCloudinary };
