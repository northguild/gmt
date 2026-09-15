---
"@northguild/gmt": patch
---

Document the `year`, `month` and `day` patterns, and correct a wrong `fractionalSecond` example.

`year`, `month` and `day` had no JSDoc, so editors showed nothing on hover. They now carry a description and examples like every other pattern in the regex namespace. The `millisecond` alias gains examples too.

The `fractionalSecond` JSDoc said `fractionalSecond.test("0")` returns `false`. It returns `true`, since `"0"` is one digit. The example now shows a 10-digit input, which the pattern does reject.
