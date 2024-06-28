import { mustBeDefined } from "../../util/must-be-defined";
import { typedKeys } from "../../util/typed-object-iter";
import type { PostprocessContext } from "../context/postprocess";

const bannerComment = () => `/**
 * This file was automatically generated – do not edit it.
 */

`;

export const prependBannerComments = (context: PostprocessContext) => {
  context.logDebug("Prepending banner comments");

  for (const file of typedKeys(context.filesToDependentIdentifiers)) {
    context.logTrace(`Prepending banner comment for ${file}`);
    context.filesToContents[file] =
      bannerComment() + mustBeDefined(context.filesToContents[file]);
  }
};
