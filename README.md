# Facelift preview (not implemented)

Static mockup only. No Quire source is touched on this branch.

The reading column stays **centred on the page**, exactly as today. The rail is
absolutely placed in the left gutter and never displaces it, and it sticks as
you scroll. It carries no border, no shadow and no background: it is typography
sitting on the page, not a panel. On a post it holds the table of contents; on
the home page it holds the categories and the tags.

Other changes: a display-size lead post, a category label on every entry, a
full-width divider replacing the 50% stub, a deck line under post titles, and
the logo red `#d80000` echoed as the single accent (the marker beside the active
rail row, and the title hover underline).

The signature logo is kept as-is. No site description on the home page.

## Desktop, 1280px

Home
![home desktop](shots/home_d.png)

Post
![post desktop](shots/post_d.png)

Post, scrolled 1000px. The rail stays with you, the active section is marked.
![post scrolled](shots/post_scrolled.png)

## Rail alignment: top vs middle

Top. The rail's first line sits exactly level with the article's first line
(measured: both at y=154). The rail reads as a companion to the text.
![rail top](shots/cmp_top_0.png)

Middle. The rail hangs in the vertical centre, level with nothing. It also
overflows once a post has enough headings to exceed the viewport.
![rail centre](shots/cmp_center_0.png)

## Mobile, 390px

Below 1280px the gutter cannot hold the rail, so it disappears entirely.
Categories, tags and the table of contents all move behind the menu button.

Home, menu closed
![home mobile](shots/home_m.png)

Home, menu open
![home mobile menu](shots/home_m_menu.png)

Post, menu open
![post mobile menu](shots/post_m_menu.png)

## Source

`mockup/` is self-contained. Open `mockup/home.html` in a browser to hover the
accent, resize the window and toggle the mobile menu.

This is an orphan branch: it carries only the preview, no Quire source. Delete
it once the direction is settled.
