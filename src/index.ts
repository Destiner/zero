import { Skill } from 'drone';

function main(): void {
  const skill = new Skill({
    name: 'hello',
    description: 'Placeholder skill verifying the vendored drone package.',
    content: 'Say hello.',
  });

  console.log(`Loaded skill: ${skill.name}`);
}

main();
