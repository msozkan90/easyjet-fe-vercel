# Scanner silent printing

Normal orders at `/dashboard/orders/printer` and transfer shipments at
`/dashboard/transfer-orders/printer` use the same printer settings and browser PDF
print path. Chrome 144+ `SilentPrintingEnabled=true` supplies silent printing on each
workstation. No JavaScript parameter can activate or detect this policy.

The Scanner settings persist only `autoPrint` under an account-specific local
storage key shared by both shipment scanners, with changes synchronized across
browser tabs. They do not store or claim to control OS printer settings. Automatic
printing defaults to the existing enabled behavior. Both order lookup and remake
label creation respect the preference. The manual Print Label button retains the
current label for retries without purchasing a new label. Starting another lookup
clears the old label. In-flight lookups and print requests prevent overlapping scans.

The settings modal exposes downloadable workstation configuration files and guides:

- [Türkçe kurulum ve geri alma](../public/printing/silent-printing-tr.txt)
- [English setup and rollback](../public/printing/silent-printing-en.txt)
- [Windows enable](../public/printing/chrome-silent-printing-enable.reg)
- [Windows remove policy](../public/printing/chrome-silent-printing-disable.reg)
- [macOS configuration profile](../public/printing/chrome-silent-printing.mobileconfig)
- [Linux managed policy](../public/printing/chrome-silent-printing.json)

Deploy these only on the intended workstations. No OS/browser policy is changed by
running or deploying the web app. The policy affects browser printing beyond this
route. Turning off auto-print only stops scan-triggered printing; manual printing
still obeys the browser policy. The web app reports a browser print request, never
confirmed physical output or verified silent-printing readiness.

Acceptance on each target OS/browser and printer driver:

1. Install the configuration; verify `SilentPrintingEnabled=true` with OK status
   at `chrome://policy`.
2. Set the actual printer and its paper defaults. Scan an order and check that
   exactly one readable, correctly sized label prints without confirmation.
3. Change the default printer and paper settings; print another label.
4. Disable auto-print, reload the Scanner and scan: no output until Print Label.
5. Verify auto-print preferences are separate for different accounts.
6. Check remake label creation in both automatic and manual modes.
7. Check rapid duplicate submissions while a lookup is pending, lookup failure,
   label download failure and retry using the current label.
8. Remove the policy and verify the normal print dialog returns. Cancel the dialog:
   no physical-print success should be reported.
9. In the transfer shipment Scanner, complete the required checklist with auto-print
   off and then on. Verify only completed shipments print automatically in the on
   mode, and that the input is ready for the next barcode after each operation.

Transfer shipments retain the existing shipping checklist and label-creation flow.
Automatic printing runs only when the shipment response reports `shipped=true`
and includes a label URL. Disabling automatic printing also applies to the
checklist-confirmation response. Re-scanning a shipped order starts a fresh print
attempt; repeated payloads within the same shipment flow do not print twice.

This does not change production scanners.
