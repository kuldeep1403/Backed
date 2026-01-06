import mongoose from "mongoose";

const videoSchema = new mongoose.Schema(
  {
    videoFile: {
      type: String,
      required: true,
    },
    videoFile_public_id: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    thumbnail_public_id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

videoSchema.index({ title: "text", description: "text" });
videoSchema.index({ owner: 1, isPublished: 1, createdAt: -1 });
videoSchema.index({ isPublished: 1, views: -1 });

export const Video = mongoose.model("Video", videoSchema);
