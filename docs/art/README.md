# Lambtae artwork

Lambtae, the career helper (the lamb in the suitcase), uses one image in two places:

- **Suitcase peek**: the image is cut just under the chin (about 66% down), so keep the face and horns above that.
- **Chat header**: she sits inside the banner of the chat box, cut at about 69% down.
- The bottom of the image is always hidden. The body can go there, but nobody will see it.

## Swap in your own art

1. Open `lamb-template.png` (512 × 512, transparent) in your drawing app as a guide layer.
2. Draw the lamb on a new layer. Keep her centred on the dashed centre line and the face above the first blue line.
3. Hide the guide layer and export **only your lamb** as `lamb.png`: 512 × 512, transparent background.
4. Save it as `static/art/lamb.png`.

The app checks for `static/art/lamb.png` on each page load. If the file is there, it is used; otherwise the original `static/art/lamb.svg` is used. No code changes are needed. Delete `lamb.png` to go back.

Tips: thick, dark outlines read better at the small size (about 44 px tall in the suitcase). Avoid fine detail below the first blue line.

To redraw the template after changing the reference SVG, see the command at the top of `lamb-template.html`.
