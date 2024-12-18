import * as core from '@actions/core';
import * as github from '@actions/github';
import { readFile, writeFile } from 'fs/promises';
import { run } from '../src/main';
import { jest } from '@jest/globals';

// Mock the GitHub API and core module
jest.mock('@actions/github');
jest.mock('@actions/core');
jest.mock('@actions/exec');
jest.mock('fs/promises');

describe('run', () => {
	const mockOctokit = {
		rest: {
			pulls: {
				get: jest.fn(),
				listCommits: jest.fn(),
			},
		},
	};

	beforeEach(() => {
		// Reset all mocks
		jest.resetAllMocks();
		(github.getOctokit as jest.Mock).mockReturnValue(mockOctokit);
		(readFile as jest.Mock).mockImplementation(() => Promise.resolve('mock file content'));
		(writeFile as jest.Mock).mockImplementation(() => Promise.resolve());

		// Mock core.getInput for required inputs
		(core.getInput as jest.Mock).mockImplementation((name) => {
			switch (name) {
				case 'owner':
					return 'test-owner';
				case 'repo':
					return 'test-repo';
				case 'pr-number':
					return '123';
				case 'token':
					return 'test-token';
				default:
					return '';
			}
		});
	});

	it('extracts changelog when include-changelog is true', async () => {
		// Mock PR response with changelog
		const mockPRBody = `
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a href="https://github.com/nextauthjs/next-auth/releases"><code>@auth/sveltekit</code>'s releases</a>.</em></p>
<blockquote>
<h2><code>@auth/sveltekit</code> 0.3.12</h2>
<h2>Other</h2>
<ul>
<li><strong><code>@auth/core</code></strong>: cookies cleanup (#9111) (ee88375f)</li>
<li><strong><code>@auth/core</code></strong>: typo in apple.ts (#9093) (419b66d0)</li>
</ul>
</blockquote>
</details>`;

		mockOctokit.rest.pulls.get.mockImplementation(() => Promise.resolve({
			data: {
				title: 'Bump @auth/sveltekit from 0.3.11 to 0.3.12',
				body: mockPRBody,
			},
			status: 200
		}));

		// Mock include-changelog input as true
		(core.getInput as jest.Mock).mockImplementation((name) => {
			switch (name) {
				case 'include-changelog':
					return 'true';
				default:
					return '';
			}
		});

		await run();

		// Verify that writeFile was called with content containing changelog
		const writeFileCalls = (writeFile as jest.Mock).mock.calls;
		const hasChangelog = writeFileCalls.some((call) => {
			const content = call[1] as string;
			return content.includes('<details>') &&
				content.includes('Release notes');
		});
		expect(hasChangelog).toBe(true);
	});

	it('does not extract changelog when include-changelog is false', async () => {
		// Mock PR response with changelog
		mockOctokit.rest.pulls.get.mockImplementation(() => Promise.resolve({
			data: {
				title: 'Bump @auth/sveltekit from 0.3.11 to 0.3.12',
				body: 'mock PR body with changelog',
			},
		}));

		// Mock include-changelog input as false (default)
		(core.getInput as jest.Mock).mockImplementation((name) => {
			if (name === 'include-changelog') return 'false';
			return '';
		});

		await run();

		// Verify that writeFile was called with content not containing changelog
		const writeFileCalls = (writeFile as jest.Mock).mock.calls;
		const hasChangelog = writeFileCalls.some((call) => {
			const content = call[1] as string;
			return content.includes('<details>') ||
				content.includes('Release notes');
		});
		expect(hasChangelog).toBe(false);
	});
});
