# Page sharing and Space views

This fork keeps a page in its original Space. Sharing grants another member
access to that original, including its current child pages and owned databases.

## Invite from a page

Open the page menu and choose **Share page**. Select **Can view** or **Can edit**,
then enter an email address.

- An active member of the Workspace receives access immediately.
- A new recipient receives an invitation link to copy and deliver yourself.
  Workspace owner/admin permission and page administration are required to
  invite a new guest. Automatic invitation email delivery is not implemented.
- The recipient signs in or creates an account on the same self-hosted server
  with the invited email, then opens the invitation link. It expires after
  seven days and is consumed when accepted.
- Accepted pages appear under **Shared with me**. The recipient can save the
  regular page link or a link to an individual block.

**Can view** permits reading the page, its inherited descendants, owned database
records, and files referenced by the page body. **Can edit** also permits editing
the shared page body. Creating child pages, changing file/database references,
editing shared database records, and administering access continue to use their
existing Space permissions. Shared body edits save back to the same document.
A conflicting document revision asks the editor to retain changes and reload.

## Understand inherited access

Sharing a parent page extends access through child pages as the tree changes.
Folder nodes do not extend this page-sharing inheritance to their contents.
Keep private internal notes outside that shared parent.

Page grants combine with access granted through the original Space or other
shared ancestors. The strongest applicable page grant wins. A direct Can view
grant on a child does not reduce Can edit inherited from a parent.

Remove the grant on **Share page**, or open the Workspace user list and its
**Page access** control to adjust grants on pages you administer. Remove all
applicable grant paths when ending someone's access. Existing copies or files
already downloaded remain in the recipient's possession.

An embedded view of an existing database also checks access to its source page.
Linking to a private database does not grant access to it. A file removed from
the page body by Undo is excluded from the shared file list and download path.
Administrators can inspect unused images for manual cleanup.

The server checks Workspace membership and page/file permissions on each
request. The sharing feature operates inside one Workspace. Workspace owner and
Space administration are distinct roles.

## Reference a page from another Space

A Space administrator can open the Space's **… → Page references** menu and
add an existing page. The sidebar entry points to the same original page.
Members see the reference when they also have access to its source page.
Grant source-page access separately to the intended recipients.

## Find and organize Spaces

Use **Search Spaces** and **Sort and filter Spaces** in the sidebar.

- Search matches Space names.
- Member and tag conditions combine with AND between fields.
- Within Members or Tags, select **Match any** or **Match all**.
- **Advanced filter** builds nested groups using **Match all (AND)** and
  **Match any (OR)**. Available fields are Space name, Member, and Tag.
  The advanced group and quick filters must both match.
- The member and tag selectors are built from Spaces the current user can read.
- Space tags are optional and editable in Space settings by its administrator.

Personal pins, sort choice, saved views, and hidden Spaces are stored in the
current user's local client metadata. They persist in that browser profile.
Cross-device synchronization of these preferences is not implemented.

**Hide Space for me** only changes your sidebar. Enable **Include my hidden
Spaces** to find it and choose **Show Space again**. Hide does not change
membership or the page's shared archive state.

## Save and send a view

1. Set the quick and advanced conditions and choose a sort order.
2. Enter a **View name** and click **Save view**.
3. Click **Copy view link** and send it to another user of the same Workspace.
4. The recipient opens it, signs in if needed, and can click **Save view** to
   keep it in their own sidebar.

The link contains the name, conditions, and sort choice at the time of copying.
Later changes require copying and sending a new link. A view link does not add
Space or page permissions. Each reader's own Hide and pin preferences still
apply. Links made before match-mode options existed keep their original AND
behavior.

The URL fragment contains the view configuration, including its name, filter
text, tag labels, and member IDs. Share links with recipients who should receive
that configuration. A recipient may see fewer results because of their access.

For example, let both animation and background teams read three Spaces. Tag the
animation Space and common-specification Space with Animation, and tag the
background Space and common-specification Space with Background. Saving a view
for each tag gives two entry points with the same common-specification original.
