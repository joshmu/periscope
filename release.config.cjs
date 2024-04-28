/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: [
    "master"
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogTitle": "# Changelog\n\nAll notable changes to this project will be documented in this file. See [Conventional Commits](https://www.conventionalcommits.org) for commit guidelines.\n\n",
        "changelogFile": "CHANGELOG.md"
      }
    ],
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": [
          "CHANGELOG.md"
        ]
      }
    ],
    "@semantic-release/github"
  ]
};