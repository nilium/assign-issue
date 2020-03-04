import * as core from '@actions/core'
import * as github from '@actions/github'

function rand(min: number, max: number): number {
  min = Math.floor(min)
  max = Math.floor(max)
  const range = max - min
  return min + Math.floor(Math.random() * range)
}

function assignTeam(team: string): void {
  const token = core.getInput('token')
  const octokit = new github.GitHub(token)

  const desc = team.split('/')
  if (desc.length !== 2) {
    throw new Error(`Team must be of the format org/team-slug`)
    return
  }
  const org = desc[0]
  const slug = desc[1]

  const options = octokit.teams.listMembersInOrg.endpoint.merge({
    org: org,
    team_slug: slug
  })

  let user: string = ''
  octokit.paginate(options).then(members => {
    if (members.length === 0) {
      core.info('No member in team: skipping action.')
      return
    }

    const i = rand(0, members.length)
    if (i >= 0 && i < members.length) {
      assignUser(members[i].login)
    }
  })
}

function assignUser(user: string): void {
  switch (github.context.eventName) {
    case 'pull_request':
      assignUserToPullRequest(user, github.context.payload.number)
      break
    case 'issue':
      assignUserToIssue(user, github.context.payload.number)
      break
    default:
      throw new Error(
        `Event is of type ${github.context.eventName}, but requires pull_request or issue`
      )
  }
}

function assignUserToPullRequest(user: string, number: number): void {
  core.info(`Assigning user @${user} to pull request #${number}`)
}

function assignUserToIssue(user: string, number: number): void {
  core.info(`Assigning user @${user} to issue #${number}`)
}

function toList(str: string): string[] {
  if (str === '') {
    return []
  }
  return str
    .split(',')
    .map(it => it.trim())
    .filter(it => it != '')
}

async function run() {
  try {
    let title: string
    switch (github.context.eventName) {
      case 'pull_request':
      case 'issue':
        const obj = github.context.payload[github.context.eventName]
        if (
          typeof obj === 'object' &&
          obj.title !== null &&
          github.context.payload.action === 'opened'
        ) {
          title = obj.title
          break
        }
        return

      default:
        core.debug(
          'Event is not a pull request or issue open action: skipping.'
        )
        return
    }

    const regex = new RegExp(core.getInput('match'), '')
    if (!regex.test(title)) {
      core.debug('Title does not match regex.')
      return
    }

    const team = core.getInput('team')
    if (team !== '') {
      core.debug(`Assigning issue to team ${team}`)
      assignTeam(team)
      return
    }

    core.info(`No team configuration found: skipping action.`)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
