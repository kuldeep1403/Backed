import fs from "fs/promises";
import { AsyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (user) => {
  try {
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    console.error(err);
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

export const registerUser = AsyncHandler(async (req, res) => {
  // get user details from frontend
  // validation
  // check if user already exists: username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return res

  const removeFiles = async (avatarLocalPath, coverImageLocalPath) => {
    if (avatarLocalPath) {
      await fs.unlink(avatarLocalPath).catch(() => {});
    }
    if (coverImageLocalPath) {
      await fs.unlink(coverImageLocalPath).catch(() => {});
    }
  };

  console.log(req.files);
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  let { fullName, username, email, password } = req.body;
  // Required field validation
  if (
    [fullName, username, email, password].some(
      (field) => !field || typeof field !== "string" || field.trim() === ""
    )
  ) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "All fields are required");
  }

  fullName = fullName.trim();
  username = username.trim().toLowerCase();
  email = email.trim().toLowerCase();

  if (fullName.length < 3) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Full name must be at least 3 characters long");
  }

  if (!/^[a-zA-Z\s]+$/.test(fullName)) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Full name can only contain letters and spaces");
  }

  if (username.length < 3 || username.length > 20) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Username must be 3–20 characters long");
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(
      400,
      "Username can only contain letters, numbers, and underscores"
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Invalid email format");
  }

  if (password.length < 8) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(password)) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(
      400,
      "Password must include uppercase, lowercase, number, and special character"
    );
  }

  const existingUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existingUser) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(409, "Email or username already exists");
  }

  if (!avatarLocalPath) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath, "avatars");
  const coverImage = await uploadOnCloudinary(
    coverImageLocalPath,
    "coverImages"
  );

  if (!avatar) {
    await removeFiles(avatarLocalPath, coverImageLocalPath);
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: avatar.secure_url,
    avatar_public_id: avatar.public_id,
    coverImage: coverImage?.secure_url || "",
    coverImage_public_id: coverImage?.public_id || "",
    email,
    password,
    username: username.toLowerCase(),
  });
  await removeFiles(avatarLocalPath, coverImageLocalPath);

  const createdUser = await User.findById({ _id: user._id }).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

export const loginUser = AsyncHandler(async (req, res) => {
  // req->body - data
  // validation
  // check if user already exists
  // passward check
  // if password correct send the token to user
  // send token

  const { username, email, password } = req.body;
  if (
    (!username || username.trim() === "") &&
    (!email || email.trim() === "")
  ) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password || password.trim() === "") {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({ $or: [{ username }, { email }] });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  console.log(password);

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(user);

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            fullName: user.fullName,
            coverImage: user.coverImage,
          },
          accessToken,
          refreshToken,
        },
        "User logged in Successfully"
      )
    );
});

export const logoutUser = AsyncHandler(async (req, res) => {
  await User.findOneAndUpdate(req.user._id, {
    $set: { refreshToken: undefined },
  });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

export const refreshAccessToken = AsyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookie.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      throw new ApiError(401, "unauthorized request");
    }

    const decodeToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodeToken._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, refreshToken } =
      await generateAccessAndRefreshToken(user);

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

export const changeCurrentPassword = AsyncHandler(async (req, res, next) => {
  const { oldPassword, newPassowrd } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password");
  }
  user.password = newPassowrd;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

export const getCurrentUser = AsyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "User fetched successfully"));
});

export const updateAccountDetails = AsyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email: email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export const updateUserAvatar = AsyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath, "avatars");

  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar");
  }

  if (req.user?.avatar_public_id) {
    await deleteOnCloudinary(req.user.avatar_public_id);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.secure_url,
        avatar_public_id: avatar.public_id,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar image updated successfully"));
});

export const updateUserCoverImage = AsyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const coverImage = await uploadOnCloudinary(
    coverImageLocalPath,
    "coverImages"
  );

  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on cover Image");
  }

  if (req.user?.coverImage_public_id) {
    await deleteOnCloudinary(req.user.coverImage_public_id);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.secure_url,
        coverImage_public_id: coverImage.public_id,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export const getUserChannelProfile = AsyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: { username: username.toLowerCase() },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subcriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

export const getWatchHistory = AsyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});
