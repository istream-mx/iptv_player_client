// @flow

import {curry} from "flow-static-land/lib/Fun";
import {isLastIndex} from "@jumpn/utils-array";

import get from "./get";
import hasKey from "./hasKey";

import type {Composite, Path} from "./types";

const getInRecur = (index, path, composite) => {
  if (isLastIndex(path, index)) return get(path[index], composite);

  return hasKey(path[index], composite)
    ? getInRecur(index + 1, path, get(path[index], composite))
    : undefined;
};

/**
 * Returns value located at the given path or undefined otherwise.
 */
const getIn = (path: Path, composite: Composite): any =>
  path.length === 0 ? undefined : getInRecur(0, path, composite);

export default curry(getIn);
