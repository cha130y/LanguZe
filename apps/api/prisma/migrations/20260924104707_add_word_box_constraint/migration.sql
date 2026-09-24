-- A highlight box has to lie inside the photo and have a real size (AIR-003).
-- The API checks this when it saves AI output; the database keeps it true whatever
-- writes the row, because the Identify game draws these boxes on the photo.
ALTER TABLE "word_occurrences"
  ADD CONSTRAINT "word_occurrences_box_inside_photo" CHECK (
    "box_x" >= 0
    AND "box_y" >= 0
    AND "box_width" > 0
    AND "box_height" > 0
    AND "box_x" + "box_width" <= 1
    AND "box_y" + "box_height" <= 1
  );
