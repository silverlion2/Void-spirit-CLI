import chalk from 'chalk';

export function showBanner(config, skillCount = 0, project = null, mcpManager = null) {
  const v = chalk.hex('#7c3aed');
  const d = chalk.hex('#a78bfa');
  const dim = chalk.dim;

  console.log('');
  console.log(v('  ╦  ╦╔═╗╦╔╦╗  ╔═╗╔═╗╦╦═╗╦╔╦╗'));
  console.log(v('  ╚╗╔╝║ ║║ ║║  ╚═╗╠═╝║╠╦╝║ ║ '));
  console.log(v('   ╚╝ ╚═╝╩═╩╝  ╚═╝╩  ╩╩╚═╩ ╩ '));
  console.log('');
  console.log(d('  Terminal AI Coding Assistant'));
  console.log(dim('  ─────────────────────────────────────'));

  if (config) {
    const provider = config.provider || 'unknown';
    const model = config.model || 'unknown';
    const cwd = process.cwd();

    console.log(dim('  Provider: ') + chalk.white(provider));
    console.log(dim('  Model:    ') + chalk.white(model));
    console.log(dim('  CWD:      ') + chalk.white(cwd));
    if (skillCount > 0) {
      console.log(dim('  Skills:   ') + chalk.white(`${skillCount} loaded`));
    }
    if (mcpManager && mcpManager.servers.size > 0) {
      const mcpToolCount = mcpManager.getTools().length;
      console.log(dim('  MCP:      ') + chalk.hex('#00d4aa')(`${mcpManager.servers.size} server(s), ${mcpToolCount} tools`));
    }
  }

  if (project) {
    const parts = [];
    if (project.frameworks.length > 0) parts.push(project.frameworks.join(', '));
    if (project.languages.length > 0) parts.push(project.languages.join(', '));
    if (parts.length > 0) {
      console.log(dim('  Project:  ') + chalk.white(parts.join(' · ')));
    }
    if (project.hasGit) {
      const gitInfo = ['git'];
      if (project.packageManager) gitInfo.push(project.packageManager);
      if (project.hasTypeScript) gitInfo.push('typescript');
      console.log(dim('  Tools:    ') + chalk.white(gitInfo.join(', ')));
    }
    if (project.instructionFiles && project.instructionFiles.length > 0) {
      console.log(dim('  Rules:    ') + chalk.hex('#22c55e')(project.instructionFiles.join(', ')));
    } else if (project.customPrompt) {
      console.log(dim('  Custom:   ') + chalk.hex('#22c55e')('project instructions loaded'));
    }
  }

  console.log(dim('  ─────────────────────────────────────'));
  console.log(dim('  🔒 Security: sandbox · blocklist · audit'));
  console.log(dim('  Type /help for commands, /exit to quit'));
  console.log('');
}
