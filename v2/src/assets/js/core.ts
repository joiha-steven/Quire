// The bundle every public page loads.
//
// It exists for one reason: analytics. A pageview that only fires on posts would undercount
// every listing, every taxonomy page and the home page, which is most of a blog's traffic.
// Nothing else belongs here unless it is genuinely needed on every page — this file is the
// only JavaScript a reader of a listing pays for, and its size is the budget.

import { track } from './track'

track()
