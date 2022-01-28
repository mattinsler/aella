# aella

## Installation

```shell
$ yarn install --dev aella
```

## Usage

```bash

USAGE
  aella COMMAND ...
  la COMMAND ...

  aella -l,--ls,--list              List available commands
  aella -b,--build PROJECT          Build a project
  aella -p,--pkg,--package PROJECT  Package a project
  aella -h,--help                   Print help information

```

## VS Code Integration

#### .vscode/settings.json
```json
{
  "json.schemas": [
    {
      "fileMatch": [
        "workspace.json"
      ],
      "url": "./node_modules/aella/workspace.schema.json"
    },
    {
      "fileMatch": [
        "project.json"
      ],
      "url": "./node_modules/aella/project.schema.json"
    }
  ]
}
```
