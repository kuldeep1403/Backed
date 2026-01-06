import { Router } from "express";
import {
  deleteVideo,
  getAllVideos,
  getAllVideosOfUser,
  getAllVideosPublic,
  getVideoById,
  publishAVideo,
  searchSuggestions,
  togglePublishStatus,
  updateVideo,
} from "../controllers/video.controller.js";
import { verifyJwt } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/").get(getAllVideosPublic);
router.route("/suggestion").get(searchSuggestions);
router.route("/videos").get(getAllVideos);

router.use(verifyJwt);

router
  .route("/getAllVideosOfUser")
  .get(getAllVideosOfUser)
  .post(
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    publishAVideo
  );

router
  .route("/:videoId")
  .get(getVideoById)
  .delete(deleteVideo)
  .patch(upload.single("thumbnail"), updateVideo);

router.route("/toggle/publish/:videoId").patch(togglePublishStatus);

export default router;
