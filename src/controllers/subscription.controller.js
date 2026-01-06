import { Subscription } from "../models/subscription.model.js";
import { AsyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/apiError.js";
import mongoose from "mongoose";

export const toggleSubscription = AsyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid channel ID");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user?._id,
    channel: channelId,
  });

  if (existingSubscription) {
    await Subscription.deleteOne({ _id: existingSubscription._id });
    return res
      .status(200)
      .json(
        new ApiResponse(200, null, "Unsubscribed from channel successfully")
      );
  } else {
    const newSubscription = await Subscription.create({
      subscriber: req.user?._id,
      channel: channelId,
    });

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          newSubscription,
          "Subscribed to channel successfully"
        )
      );
  }
});

export const getUserChannelSubscribers = AsyncHandler(async (req, res) => {
  const { channelId } = req.params;
});

export const getSubscribedChannels = AsyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
});
