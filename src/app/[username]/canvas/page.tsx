import addWeeks from 'date-fns/addWeeks'
import addMonths from 'date-fns/addMonths'
import format from 'date-fns/format'
import isAfter from 'date-fns/isAfter'
import parseISO from 'date-fns/parseISO'
import setDay from 'date-fns/setDay'
import startOfWeek from 'date-fns/startOfWeek'
import differenceInCalendarWeeks from 'date-fns/differenceInCalendarWeeks'

import Canvas, { Contrib } from './Canvas'

const DATE_FORMAT = 'yyyy-MM-dd'
const HOST = process.env.API_HOST

interface Year {
  year: string
  total: number
  range: {
    start: string
    end: string
  }
}

interface DataStruct {
  years: Year[]
  contributions: Contrib[]
}

type PageProps = {
  params: { username: string }
  searchParams: { scheme: 'light' | 'dark'; v: string }
}

export default async function CanvasPage({ params, searchParams }: PageProps) {
  const token = searchParams.v || `${Date.now()}`.substring(0, 8)
  const { data } = await getData<DataStruct>(`${HOST}/api/v1/${params.username}?v=${token}`)

  const today = new Date()
  const offset = today.getTimezoneOffset() * 60000
  const lastDate = new Date(today.getTime() + offset)
  let nextDate = startOfWeek(addMonths(lastDate, -12))
  if (differenceInCalendarWeeks(lastDate, nextDate) > 52) {
    nextDate = addWeeks(nextDate, 1)
  }

  let firstRowDates: Contrib[] = []
  const graphEntries: Contrib[][] = []
  const getContrib = (date: string) => (isAfter(parseISO(date), lastDate) ? {} : getDateInfo(data, date))

  while (!isAfter(nextDate, lastDate)) {
    const date = format(nextDate, DATE_FORMAT)
    firstRowDates.push({ date, ...getContrib(date) })
    nextDate = addWeeks(nextDate, 1)
  }
  graphEntries.push(firstRowDates)

  for (let i = 1; i < 7; i += 1) {
    graphEntries.push(
      firstRowDates.map(dateObj => {
        const date = format(setDay(parseISO(dateObj.date), i), DATE_FORMAT)
        return { date, ...getContrib(date) }
      })
    )
  }

  const count = getContributionCount(graphEntries)
  return <Canvas data={graphEntries} count={count} username={params.username} scheme={searchParams.scheme} />
}

async function getData<T>(url: string): Promise<{ data: T }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch data')
  const data = await res.json()
  return { data }
}

function getDateInfo(data: DataStruct, date: string) {
  return data.contributions.find(contrib => contrib.date === date)
}

function getContributionCount(graphEntries: Contrib[][]) {
  return graphEntries.reduce((rowTotal, row) => {
    return rowTotal + row.reduce((colTotal, col) => colTotal + (col.count || 0), 0)
  }, 0)
}
