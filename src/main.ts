import * as core from '@actions/core'
import * as github from '@actions/github'

function rand(min: number, max: number): number {
  min = Math.floor(min)
  max = Math.floor(max)
  const range = max - min
  return min + Math.floor(Math.random() * range)
}

function assignTeam(team: string): void {
  const orgToken = core.getInput('org-token')
  const octokit = new github.GitHub(orgToken)

  const desc = team.split('/')
  if (desc.length !== 2) {
    throw new Error(`Team must be of the format org/team-slug`)
  }
  const org = desc[0]
  const slug = desc[1]

  const options = octokit.teams.listMembersInOrg.endpoint.merge({
    org,
    team_slug: slug // eslint-disable-line @typescript-eslint/camelcase
  })

  octokit.paginate(options).then(async members => {
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
    case 'pull_request': {
      const number = github.context.payload.pull_request?.number
      if (typeof number == 'number') {
        assignUserToIssue(user, number)
      }
      break
    }
    case 'issues': {
      const number = github.context.payload.issue?.number
      if (number != null) {
        assignUserToIssue(user, number)
      }
      break
    }
    default:
      throw new Error(
        `Event is of type ${github.context.eventName}, but requires pull_request or issue`
      )
  }
}

function assignUserToIssue(user: string, number: number): void {
  core.info(`Assigning user @${user} to issue #${number}`)
  const repo = github.context.payload.repository
  if (repo == null) {
    throw new Error('Repository info not present in payload.')
  }
  const owner = repo.owner?.login
  if (typeof owner !== 'string') {
    throw new Error('Repository owner not present in payload.')
  }
  const repoName = repo.name
  if (typeof repoName !== 'string') {
    throw new Error('Repository name not present in payload.')
  }
  const token = core.getInput('token')
  const octokit = new github.GitHub(token)
  octokit.issues.addAssignees({
    owner,
    repo: repoName,
    issue_number: number, // eslint-disable-line @typescript-eslint/camelcase
    assignees: [user]
  })
}

async function run(): Promise<void> {
  try {
    let title: string
    switch (github.context.eventName) {
      case 'pull_request':
        if (
          github.context.payload?.issue?.assignees != null &&
          github.context.payload?.issue?.assignees.length > 0
        ) {
          core.debug('Pull request already has an assignee.')
          return
        }
        title = github.context.payload.pull_request?.title || ''
        break
      case 'issues':
        if (github.context.payload?.issue?.assignee != null) {
          core.debug('Issue already has an assignee.')
          return
        }
        title = github.context.payload.issue?.title || ''
        break

      default:
        core.info(
          `Event (${github.context.eventName}) is not a pull request or issue: skipping.`
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
