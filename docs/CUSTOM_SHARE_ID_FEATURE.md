# 🔑 Custom Share ID Feature - Implementation Guide

## Overview
Users can now **set a custom Share ID before uploading** files, allowing them to use memorable IDs or share them with recipients in advance.

---

## ✨ New Features

### 1. **Pre-Upload Share ID Setting**
- Set custom Share ID before uploading
- Generate random Share ID with one click
- Auto-generate if left empty
- Visual feedback on custom vs auto-generated IDs

### 2. **Flexible ID Options**
- **Custom ID**: Use memorable IDs like "project-2025" or "team-meeting"
- **Random ID**: Generate cryptographically secure 32-char hex IDs
- **Auto-generate**: Leave empty for automatic generation

### 3. **Real-Time Validation**
- Shows which ID will be used
- Indicates if custom or auto-generated
- Disabled during upload to prevent changes

---

## 🎯 How It Works

### User Flow

```
┌─────────────────────────────────────────────────────────┐
│ Step 1: Open Sender Page                               │
│ http://localhost:3000/sender                            │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 2: Select File                                     │
│ Choose video.mp4 (25 MB)                                │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 3: Set Custom Share ID (Optional)                 │
│                                                         │
│ 🔑 Share ID (Optional)              [Generate]         │
│ ┌─────────────────────────────────────────────┐        │
│ │ project-2025-final                          │        │
│ └─────────────────────────────────────────────┘        │
│                                                         │
│ ℹ️ Using custom Share ID: project-2025...              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 4: Click Upload                                    │
│ [Upload] button starts the transfer                     │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 5: Upload with Custom Share ID                    │
│ Backend receives:                                       │
│ {                                                       │
│   "upload_id": "video.mp4-1763257890",                  │
│   "filename": "video.mp4",                              │
│   "share_id": "project-2025-final"  ← Custom!           │
│ }                                                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ Step 6: Success - Share Custom ID                      │
│ ✅ Upload Complete!                                     │
│                                                         │
│ 🔑 Share ID: project-2025-final                         │
│ [Copy]                                                  │
│                                                         │
│ 📤 Share this with recipients                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Frontend Changes

#### 1. **New Component: ShareIDSetter**
Location: `components/upload/ShareIDSetter.tsx`

**Features:**
- Input field for custom Share ID
- Generate button for random IDs
- Visual feedback (custom vs auto)
- Disabled state during upload

**Props:**
```typescript
interface ShareIDSetterProps {
  shareId: string;           // Current share ID value
  onShareIdChange: (id: string) => void;  // Callback on change
  isDark: boolean;           // Theme support
  disabled?: boolean;        // Disable during upload
}
```

**Usage:**
```tsx
<ShareIDSetter
  shareId={state.shareId}
  onShareIdChange={state.setShareId}
  isDark={true}
  disabled={state.isUploading}
/>
```

#### 2. **Updated useUploadLogic Hook**
Location: `hooks/useUploadLogic.ts`

**Changes:**
- Added `customShareId` parameter to `startUpload()`
- Pass custom share_id to backend init call
- Include share_id in metadata if provided

**Code:**
```typescript
const metadata: any = {
  upload_id: uploadID,
  filename: file.name,
  total_chunks: chunks,
  chunk_size: CHUNK_SIZE,
};

// Include custom share_id if provided
if (customShareId && customShareId.trim()) {
  metadata.share_id = customShareId.trim();
}
```

#### 3. **Updated FileUpload Component**
Location: `components/FileUpload.tsx`

**Changes:**
- Import ShareIDSetter component
- Add ShareIDSetter to UI
- Pass `state.shareId` to `startUpload()`

**Code:**
```tsx
<ShareIDSetter
  shareId={state.shareId}
  onShareIdChange={state.setShareId}
  isDark={true}
  disabled={state.isUploading}
/>
```

### Backend Changes

#### Already Implemented!
Location: `server/orchestrator/controllers/upload.go`

**Existing Logic:**
```go
// Generate unique share ID if not provided
if md.ShareID == "" {
    md.ShareID = helpers.GenerateShareID()
}
```

**Behavior:**
- If `share_id` provided in request → Use it
- If `share_id` empty or missing → Auto-generate

✅ **No backend changes needed!**

---

## 📊 API Changes

### POST `/init` - Updated Behavior

#### Request (with custom share_id):
```json
{
  "upload_id": "video.mp4-1763257890",
  "filename": "video.mp4",
  "total_chunks": 100,
  "chunk_size": 1048576,
  "share_id": "project-2025-final"
}
```

#### Response:
```json
{
  "upload_id": "video.mp4-1763257890",
  "share_id": "project-2025-final"
}
```

#### Request (without share_id):
```json
{
  "upload_id": "video.mp4-1763257890",
  "filename": "video.mp4",
  "total_chunks": 100,
  "chunk_size": 1048576
}
```

#### Response (auto-generated):
```json
{
  "upload_id": "video.mp4-1763257890",
  "share_id": "a9738c397fc7b00786a4c8c9fe3831c6"
}
```

---

## 🧪 Testing

### Test 1: Custom Share ID
```bash
# Start backend
cd server/orchestrator && ./aetherlink.exe

# Test with custom ID
curl -X POST http://localhost:8080/init \
  -H "Content-Type: application/json" \
  -d '{
    "upload_id": "test-custom",
    "filename": "test.mp4",
    "total_chunks": 1,
    "chunk_size": 1048576,
    "share_id": "my-custom-id-123"
  }'

# Expected response:
# {"upload_id":"test-custom","share_id":"my-custom-id-123"}
```

### Test 2: Auto-Generated Share ID
```bash
# Test without custom ID
curl -X POST http://localhost:8080/init \
  -H "Content-Type: application/json" \
  -d '{
    "upload_id": "test-auto",
    "filename": "test.mp4",
    "total_chunks": 1,
    "chunk_size": 1048576
  }'

# Expected response:
# {"upload_id":"test-auto","share_id":"a9738c397fc7b00786a4c8c9fe3831c6"}
```

### Test 3: Frontend Flow
1. Open `http://localhost:3000/sender`
2. Select a file
3. Enter custom Share ID: "test-2025"
4. Click Upload
5. Verify success message shows "test-2025"
6. Open `http://localhost:3000/receiver`
7. Enter "test-2025" as Share ID
8. Verify file appears in list

---

## 💡 Usage Examples

### Example 1: Team Project
```
Sender sets Share ID: "team-alpha-project"
→ Uploads files
→ Shares "team-alpha-project" with team via email

Team members:
→ Open receiver
→ Enter "team-alpha-project"
→ Access all team files
```

### Example 2: Time-Based Sharing
```
Sender sets Share ID: "meeting-nov-16-2025"
→ Uploads presentation slides
→ Shares ID in meeting chat

Attendees:
→ Join meeting
→ Use "meeting-nov-16-2025" to download slides
→ Easy to remember, no long hex strings
```

### Example 3: Random Secure ID
```
Sender clicks [Generate] button
→ Gets: "a9738c397fc7b00786a4c8c9fe3831c6"
→ Uploads sensitive documents
→ Shares via secure channel

Recipient:
→ Pastes exact ID
→ Accesses files securely
→ ID is too long to guess
```

### Example 4: Auto-Generated
```
Sender leaves Share ID empty
→ Uploads files
→ Backend auto-generates ID
→ Shows ID in success message
→ Sender copies and shares

Works exactly like before!
```

---

## 🎨 UI Components

### ShareIDSetter Component

**Features:**
- Clean, modern design
- Purple theme (matches Share ID branding)
- Generate button with refresh icon
- Real-time status indicator
- Info text explaining current state

**States:**
1. **Empty** - "A random Share ID will be auto-generated"
2. **Custom** - "Using custom Share ID: xxx..."
3. **Generated** - "Generated Share ID will be used"
4. **Disabled** - Grayed out during upload

**Visual Design:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔑 Share ID (Optional)              [🔄 Generate]      │
│ ┌─────────────────────────────────────────────────┐    │
│ │ project-2025-final                              │    │
│ └─────────────────────────────────────────────────┘    │
│                                                         │
│ ℹ️ Using custom Share ID: project-2025...              │
└─────────────────────────────────────────────────────────┘
```

---

## 🔒 Security Considerations

### Custom Share IDs
- **Pros**: Easy to remember, can communicate verbally
- **Cons**: Less secure than random IDs (guessable)

**Recommendations:**
- Use random IDs for sensitive files
- Use custom IDs for team/internal sharing
- Combine with additional password protection (future)

### ID Format
- **Custom IDs**: Any string (recommend 8+ characters)
- **Generated IDs**: 32-character hex (128-bit entropy)

### Validation
- **Frontend**: Basic trim and length check
- **Backend**: Accepts any non-empty string
- **Future**: Add ID format validation, reserved words

---

## 📝 Best Practices

### When to Use Custom IDs
✅ Team projects - "team-alpha-q4-2025"
✅ Events - "conference-nov-2025"
✅ Meetings - "standup-monday-am"
✅ Easy sharing - "project-x-final"

### When to Use Random IDs
✅ Sensitive documents
✅ Personal files
✅ Public sharing (unknown recipients)
✅ Maximum security

### ID Naming Tips
- Keep it short but meaningful
- Use hyphens for readability: "team-alpha" not "teamalpha"
- Include dates: "project-nov-2025"
- Avoid special characters that need URL encoding
- Don't use personally identifiable information

---

## 🚀 Future Enhancements

### Planned Features
- [ ] ID format validation (alphanumeric + hyphens)
- [ ] Reserved word blocking ("admin", "test", etc.)
- [ ] ID availability check (prevent duplicates)
- [ ] Share ID history/favorites
- [ ] QR code generation for custom IDs
- [ ] Expiry dates for custom IDs
- [ ] Password protection option
- [ ] ID templates ("project-{date}", "team-{name}")

### UI Improvements
- [ ] ID strength indicator
- [ ] Suggested IDs based on filename
- [ ] Copy button next to input
- [ ] Show ID immediately in upload progress
- [ ] ID validation feedback (red/green border)

---

## 📊 Summary

### What Changed
✅ Added ShareIDSetter component
✅ Integrated into FileUpload UI
✅ Updated useUploadLogic to pass custom share_id
✅ Backend already supported custom IDs
✅ Full end-to-end custom Share ID flow

### User Benefits
🎯 **Memorable IDs** - Use "team-project" instead of "a9738c39..."
🎯 **Pre-sharing** - Share ID before upload completes
🎯 **Flexibility** - Choose custom or random
🎯 **Easy Communication** - Say "Use share-code alpha-team"

### Status
✅ **Frontend**: Complete
✅ **Backend**: Already supported
✅ **Testing**: Ready for manual testing
✅ **Documentation**: Complete

**The feature is ready to use! 🎉**

---

## 🧪 Quick Test Commands

```bash
# Terminal 1: Start backend
cd server/orchestrator
./aetherlink.exe

# Terminal 2: Start frontend
npm run dev

# Browser: Test custom Share ID
# 1. Open http://localhost:3000/sender
# 2. Select file
# 3. Enter Share ID: "test-123"
# 4. Upload
# 5. Verify "test-123" appears in success message
# 6. Open http://localhost:3000/receiver
# 7. Enter "test-123"
# 8. Verify file appears
```

**Expected Behavior:**
- Share ID field appears below file selector
- Can type custom ID or click Generate
- Upload uses custom ID if provided
- Success message shows the custom ID
- Receiver can access with custom ID

**Ready to test! 🚀**
