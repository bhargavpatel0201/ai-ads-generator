import ProjectCard from '../components/ProjectCard'
import type { Project } from '../types'

type CommunityItem = {
  gen: Project
}

const items: CommunityItem[] = [
  {
    gen: {
      id: 1,
      title: 'Why CS degrees still matter in 2026',
      productName: 'Why CS degrees still matter in 2026',
      status: 'published',
      createdAt: '2026-04-21T05:30:00',
      productDescription:
        'Hot take post arguing that fundamentals (data structures, OS, networks) compound — even when AI writes a lot of code.',
      userPrompt: 'Topic: CS degrees in 2026 · Tone: Controversial · Style: Corporate',
      authorName: 'Aarav Shah',
      likes: 128,
      tags: ['career', 'cs', 'controversial'],
    },
  },
  {
    gen: {
      id: 2,
      title: 'The dark side of AI productivity tools',
      productName: 'The dark side of AI productivity tools',
      status: 'published',
      createdAt: '2026-04-22T10:10:00',
      productDescription:
        'Storytelling post about how automating everything ate her focus — and what she does now to push back.',
      userPrompt: 'Topic: AI productivity tools · Tone: Storytelling · Style: Cyberpunk',
      authorName: 'Sophia Martin',
      likes: 184,
      tags: ['ai', 'productivity', 'storytelling'],
    },
  },
  {
    gen: {
      id: 3,
      title: 'Stop learning frameworks — learn fundamentals',
      productName: 'Stop learning frameworks — learn fundamentals',
      status: 'published',
      createdAt: '2026-04-23T08:00:00',
      productDescription:
        'Frameworks ship fast and die fast. Fundamentals — algorithms, networking, operating systems — outlast every UI fad.',
      userPrompt: 'Topic: Learn fundamentals not frameworks · Tone: Professional · Style: Minimal',
      authorName: 'Rahul Verma',
      likes: 256,
      tags: ['developer', 'fundamentals', 'mindset'],
    },
  },
  {
    gen: {
      id: 4,
      title: 'I got rejected 50 times before my first dev job',
      productName: 'I got rejected 50 times before my first dev job',
      status: 'published',
      createdAt: '2026-04-24T07:10:00',
      productDescription:
        'Long-form retrospective on rejection, deliberate practice, and the small daily wins that finally got the offer.',
      userPrompt: 'Topic: 50 rejections before first dev job · Tone: Storytelling · Style: 3D Render',
      authorName: 'Priya Kapoor',
      likes: 342,
      tags: ['career', 'job-hunt', 'storytelling'],
    },
  },
  {
    gen: {
      id: 5,
      title: 'What ecommerce brands underestimate about retention',
      productName: 'What ecommerce brands underestimate about retention',
      status: 'published',
      createdAt: '2026-04-25T12:45:00',
      productDescription:
        'Acquisition costs keep rising; retention is the cheaper growth lever most DTC brands ignore. Three plays that actually move the needle.',
      userPrompt: 'Topic: Ecommerce retention · Tone: Professional · Style: Isometric',
      authorName: 'Marcus Lee',
      likes: 92,
      tags: ['ecommerce', 'growth', 'retention'],
    },
  },
  {
    gen: {
      id: 6,
      title: 'Founders: stop measuring effort, measure leverage',
      productName: 'Founders: stop measuring effort, measure leverage',
      status: 'published',
      createdAt: '2026-04-26T09:15:00',
      productDescription:
        'Working harder is the wrong scoreboard. Output per hour, leverage per decision — that’s the founder game.',
      userPrompt: 'Topic: Founder leverage vs effort · Tone: Controversial · Style: Auto',
      authorName: 'Elena Brooks',
      likes: 146,
      tags: ['startup', 'founder', 'leadership'],
    },
  },
]

export default function Community() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:py-10">
      <div className="fixed inset-0 overflow-hidden -z-20 pointer-events-none">
        <div className="absolute rounded-full top-80 left-2/5 -translate-x-1/2 size-130 bg-[#D10A8A] blur-[100px]" />
        <div className="absolute rounded-full top-80 right-0 -translate-x-1/2 size-130 bg-[#2E08CF] blur-[100px]" />
        <div className="absolute rounded-full top-0 left-1/2 -translate-x-1/2 size-130 bg-[#F26A06] blur-[100px]" />
      </div>

      <section className="glass rounded-2xl border border-white/20 p-6 md:p-8">
        <div>
          <div>
            <h1 className="text-3xl font-semibold md:text-4xl">Community</h1>
            <p className="mt-2 text-sm text-gray-300">
              Real LinkedIn posts shipped with AI LinkedIn Studio — Gemini for copy, Replicate SDXL + Sharp for the
              header image. Hover a card for details.
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ProjectCard key={item.gen.id} gen={item.gen} forCommunity />
          ))}
        </div>
      </section>
    </div>
  )
}
