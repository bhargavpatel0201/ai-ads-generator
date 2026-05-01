import { useEffect, useMemo, useRef, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Clock3Icon,
  EyeIcon,
  HeartIcon,
  PlayIcon,
  Share2Icon,
  SparklesIcon,
  UserIcon,
  PackageIcon,
  Trash2Icon,
  MoreVerticalIcon,
  ImageIcon,
  VideoIcon,
  EyeOffIcon,
  GlobeIcon,
  ArrowUpRightIcon,
} from 'lucide-react'
import type { Project } from '../types'

const ProjectCard = ({
  gen,
  setGenerations,
  forCommunity = false,
  className = '',
  onViewDetails,
}: {
  gen: Project
  setGenerations?: Dispatch<SetStateAction<Project[]>>
  forCommunity?: boolean
  className?: string
  onViewDetails?: (gen: Project) => void
}) => {
  const navigate = useNavigate()
  const title = gen.title
  const description = gen.description || gen.productDescription
  const status = gen.status || 'draft'
  const createdAt = gen.createdAt
  const updatedAt = gen.updatedAt
  const aspectRatio = gen.aspectRatio
  const userPrompt = gen.userPrompt
  const views = gen.views
  const tags = gen.tags || []
  const uploadedImages = gen.uploadedImages || []
  const productImage = gen.productImage || uploadedImages[0]
  const modelImage = gen.modelImage || uploadedImages[1]
  const productName = gen.productName || gen.title
  const generatedImage = gen.generatedImage
  const generatedVideo = gen.generatedVideo
  const authorName = gen.authorName
  const authorAvatar = gen.authorAvatar
  const initialLikes = gen.likes ?? 0

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(initialLikes)
  const [menuOpen, setMenuOpen] = useState(false)
  const hasPlayableVideo = Boolean(generatedVideo && !videoFailed)

  useEffect(() => {
    if (!menuOpen) return
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const readableUpdatedAt = useMemo(() => {
    if (!updatedAt) return undefined
    const date = new Date(updatedAt)
    if (Number.isNaN(date.getTime())) return updatedAt
    return date.toLocaleDateString()
  }, [updatedAt])

  const readableCreatedAt = useMemo(() => {
    if (!createdAt) return undefined
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return createdAt
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [createdAt])

  const statusClasses =
    status === 'published'
      ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-400/40'
      : status === 'processing'
        ? 'bg-amber-300/90 text-black ring-1 ring-amber-200/60'
        : 'bg-white/15 text-gray-200 ring-1 ring-white/20'

  function handleRemove(e: MouseEvent) {
    e.stopPropagation()
    if (!setGenerations) return
    setGenerations((prev) => prev.filter((item) => item.id !== gen.id))
  }

  function handleLike(e: MouseEvent) {
    e.stopPropagation()
    setLiked((prev) => {
      const next = !prev
      setLikeCount((count) => count + (next ? 1 : -1))
      return next
    })
  }

  function handleShare(e: MouseEvent) {
    e.stopPropagation()
    if (typeof navigator === 'undefined') return
    if (navigator.share) {
      navigator
        .share({ title: productName, text: description || 'Check this AI ad!' })
        .catch(() => {})
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${productName}${description ? ' - ' + description : ''}`)
    }
  }

  function handleDownload(url: string | undefined, filename: string, e: MouseEvent) {
    e.stopPropagation()
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setMenuOpen(false)
  }

  function handleViewDetails(e: MouseEvent) {
    e.stopPropagation()
    if (onViewDetails) {
      onViewDetails(gen)
      return
    }
    navigate(`/result/${gen.id}`)
  }

  function handleTogglePublish(e: MouseEvent) {
    e.stopPropagation()
    if (!setGenerations) return
    setGenerations((prev) =>
      prev.map((item) =>
        item.id === gen.id
          ? { ...item, status: item.status === 'published' ? 'draft' : 'published' }
          : item,
      ),
    )
  }

  function handleCardMouseEnter() {
    if (!videoRef.current) return
    videoRef.current.play().catch(() => {})
  }

  function handleCardMouseLeave() {
    if (!videoRef.current) return
    videoRef.current.pause()
    videoRef.current.currentTime = 0
  }

  return (
    <article
      className={`group glass relative flex flex-col overflow-hidden rounded-2xl border border-white/15 p-3 shadow-lg shadow-black/20 transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:bg-white/15 ${className}`}
      onMouseEnter={handleCardMouseEnter}
      onMouseLeave={handleCardMouseLeave}
    >
      {(generatedImage || generatedVideo) && (
        <div className="relative h-56 w-full overflow-hidden rounded-xl bg-gradient-to-br from-white/10 to-white/5">
          {generatedImage && (
            <img
              src={generatedImage}
              alt={productName}
              className={`absolute inset-0 h-full w-full object-cover transition duration-500 ${
                hasPlayableVideo ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-105'
              }`}
            />
          )}

          {hasPlayableVideo && (
            <video
              ref={videoRef}
              src={generatedVideo}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100"
              onError={() => setVideoFailed(true)}
            />
          )}

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/30" />

          {hasPlayableVideo && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-100 transition duration-300 group-hover:opacity-0">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 shadow-xl backdrop-blur">
                <PlayIcon className="size-5 fill-black text-black" />
              </span>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize backdrop-blur ${statusClasses}`}
            >
              {status === 'processing' ? (
                <SparklesIcon className="size-3 animate-pulse" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
              {status === 'processing' ? 'Generating' : status}
            </span>

            <div className="flex items-center gap-2">
              {aspectRatio ? (
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-medium text-white/90 backdrop-blur ring-1 ring-white/15">
                  Aspect: {aspectRatio}
                </span>
              ) : null}

              {!forCommunity ? (
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpen((v) => !v)
                    }}
                    aria-label="Open actions"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white/90 backdrop-blur ring-1 ring-white/15 transition hover:bg-black/70"
                  >
                    <MoreVerticalIcon className="size-4" />
                  </button>
                  {menuOpen ? (
                    <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-white/15 bg-[#1a1643]/95 text-sm text-gray-100 shadow-xl backdrop-blur">
                      <button
                        type="button"
                        onClick={(e) => handleDownload(generatedImage, `${productName || 'image'}.png`, e)}
                        disabled={!generatedImage}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-40"
                      >
                        <ImageIcon className="size-4" />
                        Download Image
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownload(generatedVideo, `${productName || 'video'}.mp4`, e)}
                        disabled={!generatedVideo}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/10 disabled:opacity-40"
                      >
                        <VideoIcon className="size-4" />
                        Download Video
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          handleShare(e)
                          setMenuOpen(false)
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/10"
                      >
                        <Share2Icon className="size-4" />
                        Share
                      </button>
                      {setGenerations ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            handleRemove(e)
                            setMenuOpen(false)
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-300 transition hover:bg-red-500/15"
                        >
                          <Trash2Icon className="size-4" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {forCommunity && (productImage || modelImage) ? (
            <div className="absolute bottom-2 right-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 rounded-full bg-black/65 px-1.5 py-1 backdrop-blur ring-1 ring-white/15">
                {productImage ? (
                  <img
                    src={productImage}
                    alt="Product"
                    className="h-6 w-6 rounded-full border border-white/80 object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/10">
                    <PackageIcon className="size-3 text-white/70" />
                  </span>
                )}
                <span className="pr-1 text-[10px] font-medium text-white/95">Product</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-black/65 px-1.5 py-1 backdrop-blur ring-1 ring-white/15">
                {modelImage ? (
                  <img
                    src={modelImage}
                    alt="Model"
                    className="h-6 w-6 rounded-full border border-white/80 object-cover"
                  />
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/10">
                    <UserIcon className="size-3 text-white/70" />
                  </span>
                )}
                <span className="pr-1 text-[10px] font-medium text-white/95">Model</span>
              </div>
            </div>
          ) : null}

          {forCommunity && authorName ? (
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 backdrop-blur ring-1 ring-white/15">
              {authorAvatar ? (
                <img src={authorAvatar} alt={authorName} className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/70">
                  <UserIcon className="size-3 text-white" />
                </span>
              )}
              <span className="text-[10px] font-medium text-white/90">{authorName}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex flex-1 flex-col gap-2 rounded-xl bg-[#1a1643]/80 p-3 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{productName || title}</h3>
            {readableCreatedAt ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-gray-300">
                <Clock3Icon className="size-3" />
                {readableCreatedAt}
              </p>
            ) : null}
          </div>
          {!forCommunity && aspectRatio ? (
            <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-gray-200 ring-1 ring-white/10">
              {aspectRatio}
            </span>
          ) : null}
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Description</p>
          <p className="text-sm leading-relaxed text-gray-200 line-clamp-2">
            {description || 'No description provided.'}
          </p>
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Prompt</p>
          <p className="text-xs leading-relaxed text-gray-300 line-clamp-2">
            {userPrompt || 'No prompt provided.'}
          </p>
        </div>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-300 ring-1 ring-white/10"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {!forCommunity ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleViewDetails}
              className="btn glass inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium"
            >
              <ArrowUpRightIcon className="size-3.5" />
              View Details
            </button>
            <button
              type="button"
              onClick={handleTogglePublish}
              className={`btn inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium ${
                status === 'published'
                  ? 'glass hover:bg-white/15'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600'
              }`}
            >
              {status === 'published' ? (
                <>
                  <EyeOffIcon className="size-3.5" />
                  Unpublish
                </>
              ) : (
                <>
                  <GlobeIcon className="size-3.5" />
                  Publish
                </>
              )}
            </button>
          </div>
        ) : null}

        <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleLike}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] transition ${
                liked
                  ? 'bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/40'
                  : 'text-gray-300 hover:bg-white/10'
              }`}
              aria-label="Like"
            >
              <HeartIcon className={`size-3.5 ${liked ? 'fill-pink-400 text-pink-400' : ''}`} />
              {likeCount}
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-gray-300 transition hover:bg-white/10"
              aria-label="Share"
            >
              <Share2Icon className="size-3.5" />
              Share
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {typeof views === 'number' ? (
              <span className="inline-flex items-center gap-1">
                <EyeIcon className="size-3.5" />
                {views.toLocaleString()}
              </span>
            ) : null}
            {readableUpdatedAt && !forCommunity ? (
              <span className="inline-flex items-center gap-1">
                <Clock3Icon className="size-3.5" />
                {readableUpdatedAt}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}

export default ProjectCard
