const ANILIST_URL = 'https://graphql.anilist.co'

const MEDIA_FIELDS = `
  id
  title { english romaji }
  coverImage { large extraLarge }
  bannerImage
  averageScore
  episodes
  genres
  description(asHtml: false)
  status
`

async function query(q, variables = {}) {
  const res = await fetch(ANILIST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q, variables }),
  })
  const json = await res.json()
  if (json.errors) {
    console.error('[AniList] GraphQL errors:', json.errors)
    return []
  }
  return json.data?.Page?.media ?? []
}

export const getTrendingAnime = (page = 1, perPage = 28) =>
  query(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage })

export const getPopularAnime = (page = 1, perPage = 28) =>
  query(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage })

export const getTopRatedAnime = (page = 1, perPage = 28) =>
  query(`
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        media(sort: SCORE_DESC, type: ANIME, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { page, perPage })

export const searchAnime = (search) =>
  query(`
    query ($search: String) {
      Page(perPage: 12) {
        media(type: ANIME, search: $search, isAdult: false) { ${MEDIA_FIELDS} }
      }
    }
  `, { search })
