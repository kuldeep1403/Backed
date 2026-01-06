import { AsyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/apiError.js";
import mongoose from "mongoose";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.model.js";
import { deleteOnCloudinary } from "../utils/cloudinary.js";

export const getAllVideosOfUser = AsyncHandler(async (req, res) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  const skip = (page - 1) * limit;

  const [videos, totalVideos] = await Promise.all([
    Video.find({ owner: userId })
      .skip(skip)
      .limit(limit)
      .populate("owner", "username fullName coverImage")
      .sort({ createdAt: -1 }),

    Video.countDocuments({ owner: userId }),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        videos,
        pagination: {
          totalVideos,
          currentPage: page,
          totalPages: Math.ceil(totalVideos / limit),
          limit,
        },
      },
      "Videos fetched successfully"
    )
  );
});

export const publishAVideo = AsyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video file is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail image is required");
  }

  const videoUpload = await uploadOnCloudinary(videoLocalPath, "videos");
  const thumbnailUpload = await uploadOnCloudinary(
    thumbnailLocalPath,
    "thumbnails"
  );

  if (!videoUpload || !videoUpload.secure_url) {
    throw new ApiError(500, "Failed to upload video file");
  }

  if (!thumbnailUpload || !thumbnailUpload.secure_url) {
    throw new ApiError(500, "Failed to upload thumbnail image");
  }

  const createdVideo = await Video.create({
    videoFile: videoUpload.secure_url,
    videoFile_public_id: videoUpload.public_id,
    thumbnail: thumbnailUpload.secure_url,
    thumbnail_public_id: thumbnailUpload.public_id,
    title,
    description,
    duration: videoUpload.duration || 0,
    owner: req.user?._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, createdVideo, "Video published successfully"));
});

export const getVideoById = AsyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId).populate(
    "owner",
    "username fullName coverImage"
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

export const updateVideo = AsyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  if (title) video.title = title;
  if (description) video.description = description;

  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

export const deleteVideo = AsyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  if (video.videoFile_public_id) {
    await deleteOnCloudinary(video.videoFile_public_id);
  }

  if (video.thumbnail_public_id) {
    await deleteOnCloudinary(video.thumbnail_public_id);
  }

  await video.remove();

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Video deleted successfully"));
});

export const togglePublishStatus = AsyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (video.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        video,
        `Video has been ${video.isPublished ? "published" : "unpublished"}`
      )
    );
});
