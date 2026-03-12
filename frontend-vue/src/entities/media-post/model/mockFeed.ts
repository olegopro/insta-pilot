import type { MediaPost } from './types'

export const MOCK_FEED: MediaPost[] = [
  {
    pk: 'mock1',
    id: 'mock1_1',
    code: 'MOCK001',
    takenAt: '2026-03-10T08:30:00+00:00',
    mediaType: 1,
    thumbnailUrl: 'https://picsum.photos/seed/insta1/600/750',
    videoUrl: null,
    captionText: 'Golden hour vibes 🌅 #photography #nature #landscape',
    likeCount: 2341,
    commentCount: 87,
    viewCount: 0,
    hasLiked: false,
    user: {
      pk: 'mockuser1',
      username: 'landscape.lens',
      fullName: 'Alex Nature',
      profilePicUrl: 'https://picsum.photos/seed/avatar1/100/100'
    },
    resources: [],
    locationName: 'Yosemite National Park'
  },
  {
    pk: 'mock2',
    id: 'mock2_1',
    code: 'MOCK002',
    takenAt: '2026-03-09T14:15:00+00:00',
    mediaType: 8,
    thumbnailUrl: 'https://picsum.photos/seed/insta2/600/600',
    videoUrl: null,
    captionText: 'Weekend trip highlights ✈️🌍 Swipe to see more!',
    likeCount: 5820,
    commentCount: 214,
    viewCount: 0,
    hasLiked: true,
    user: {
      pk: 'mockuser2',
      username: 'travel.diaries',
      fullName: 'Jordan Miles',
      profilePicUrl: 'https://picsum.photos/seed/avatar2/100/100'
    },
    resources: [
      { pk: 'r1', mediaType: 1, thumbnailUrl: 'https://picsum.photos/seed/insta2a/600/600', videoUrl: null },
      { pk: 'r2', mediaType: 1, thumbnailUrl: 'https://picsum.photos/seed/insta2b/600/600', videoUrl: null },
      { pk: 'r3', mediaType: 1, thumbnailUrl: 'https://picsum.photos/seed/insta2c/600/600', videoUrl: null }
    ],
    locationName: 'Barcelona, Spain'
  },
  {
    pk: 'mock3',
    id: 'mock3_1',
    code: 'MOCK003',
    takenAt: '2026-03-09T09:00:00+00:00',
    mediaType: 1,
    thumbnailUrl: 'https://picsum.photos/seed/insta3/600/800',
    videoUrl: null,
    captionText: 'Morning coffee routine ☕ Nothing beats the first cup of the day',
    likeCount: 934,
    commentCount: 31,
    viewCount: 0,
    hasLiked: false,
    user: {
      pk: 'mockuser3',
      username: 'daily.brew',
      fullName: 'Sam Coffee',
      profilePicUrl: 'https://picsum.photos/seed/avatar3/100/100'
    },
    resources: [],
    locationName: null
  },
  {
    pk: 'mock4',
    id: 'mock4_1',
    code: 'MOCK004',
    takenAt: '2026-03-08T18:45:00+00:00',
    mediaType: 2,
    thumbnailUrl: 'https://picsum.photos/seed/insta4/600/600',
    videoUrl: null,
    captionText: 'New reel dropping 🎬 #dance #trending',
    likeCount: 12500,
    commentCount: 430,
    viewCount: 89700,
    hasLiked: false,
    user: {
      pk: 'mockuser4',
      username: 'creative.clips',
      fullName: 'Riley Studio',
      profilePicUrl: 'https://picsum.photos/seed/avatar4/100/100'
    },
    resources: [],
    locationName: 'Los Angeles, CA'
  },
  {
    pk: 'mock5',
    id: 'mock5_1',
    code: 'MOCK005',
    takenAt: '2026-03-08T11:20:00+00:00',
    mediaType: 1,
    thumbnailUrl: 'https://picsum.photos/seed/insta5/600/900',
    videoUrl: null,
    captionText: 'City lights and late nights 🌃 #urban #cityscape #nightphotography',
    likeCount: 3670,
    commentCount: 102,
    viewCount: 0,
    hasLiked: false,
    user: {
      pk: 'mockuser5',
      username: 'urban.frames',
      fullName: 'Casey Urban',
      profilePicUrl: 'https://picsum.photos/seed/avatar5/100/100'
    },
    resources: [],
    locationName: 'New York City'
  },
  {
    pk: 'mock6',
    id: 'mock6_1',
    code: 'MOCK006',
    takenAt: '2026-03-07T16:00:00+00:00',
    mediaType: 8,
    thumbnailUrl: 'https://picsum.photos/seed/insta6/600/600',
    videoUrl: null,
    captionText: 'Home studio setup reveal 🎨 The creative space I always dreamed of',
    likeCount: 7890,
    commentCount: 298,
    viewCount: 0,
    hasLiked: true,
    user: {
      pk: 'mockuser6',
      username: 'studio.setup',
      fullName: 'Morgan Design',
      profilePicUrl: 'https://picsum.photos/seed/avatar6/100/100'
    },
    resources: [
      { pk: 'r4', mediaType: 1, thumbnailUrl: 'https://picsum.photos/seed/insta6a/600/600', videoUrl: null },
      { pk: 'r5', mediaType: 1, thumbnailUrl: 'https://picsum.photos/seed/insta6b/600/600', videoUrl: null }
    ],
    locationName: null
  }
]
