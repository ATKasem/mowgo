# Client Pricing Review — Proposed Improvement

## Goal
Make the client review feature genuinely useful for an owner decision, not just a low-rate number.

## Proposed experience
Keep the existing Clients > Needs Review location, but explain it as Pricing opportunities in the content.

For each flagged client show:
- Client name
- Pricing may need a closer look
- Visit price
- Average scheduled minutes
- Estimated hourly rate
- Eligible-client average
- Completed-job count
- Exact reason it appeared: percentage of average and threshold
- Clear disclaimer: scheduled duration estimate, not actual time tracking
- Review guidance: check scheduled time, route value, and client value before changing price
- Action: Review client / change price through existing edit flow

## Product language
Do not call a client bad, unprofitable, or recommend dropping them. This is a pricing signal, not a final recommendation. Route context and payment/referral value are not currently reliable enough to claim.

## Empty state
Use one unified section:
- Pricing opportunities
- You're all set
- No pricing opportunities found. Eligible clients are within expected range for scheduled time.
- MowGo checks again as more jobs are completed. Estimate uses scheduled time, not a timer.

## Future accuracy
Actual start/end timestamps, service minutes, and travel minutes could later replace scheduled-duration estimates. Do not implement that in this proposal.

## Scope
Design/product review only. No code changes requested by this document.
