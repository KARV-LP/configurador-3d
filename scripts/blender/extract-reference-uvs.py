"""Extrai do GLB de referência os dados completos de UV das seis faces K-ARV.

Compatível com Blender 3.6+ e 4.x. Não altera nem salva o GLB.
Ao terminar, envie os dois arquivos gerados para análise.
"""

import gzip
import hashlib
import json
import os
import re
import struct
from datetime import datetime, timezone
from pathlib import Path

import bpy

# CONFIGURAÇÃO ---------------------------------------------------------------
# Opção A: deixe vazio e abra/importe o GLB manualmente antes de executar.
# Opção B: informe o caminho absoluto do GLB para o script importá-lo.
REFERENCE_GLB = os.environ.get("KARV_REFERENCE_GLB", r"")

# Vazio = cria a pasta KARV_UV_EXPORT na Área de Trabalho.
OUTPUT_FOLDER = os.environ.get("KARV_UV_OUTPUT", r"")

FACE_SPECS = (
    {
        "face": "Assento",
        "names": ("ASSENTO",),
        "expected_uv": "TEXCOORD_1",
    },
    {
        "face": "Frente do encosto",
        "names": ("ENCOSTO_FRONTAL", "FRENTE_DO_ENCOSTO"),
        "expected_uv": "TEXCOORD_1",
    },
    {
        "face": "Lateral do encosto",
        "names": ("ENCOSTO_LATERAL",),
        "expected_uv": "TEXCOORD_2",
    },
    {
        "face": "Traseira do encosto",
        "names": ("ENCOSTO_TRASEIRO", "TRASEIRA_DO_ENCOSTO"),
        "expected_uv": "TEXCOORD_2",
    },
    {
        "face": "Lateral externa",
        "names": ("LATERAL_EXTERNA",),
        "expected_uv": "TEXCOORD_1",
    },
    {
        "face": "Lateral interna",
        "names": ("LATERAL_INTERNA",),
        "expected_uv": "TEXCOORD_2",
    },
)
# -----------------------------------------------------------------------------


def normalized_name(value):
    value = re.sub(r"\.\d{3}$", "", value or "")
    return re.sub(r"[^A-Z0-9]+", "_", value.upper()).strip("_")


def rounded(values):
    return [round(float(value), 9) for value in values]


def matrix_rows(matrix):
    return [rounded(row) for row in matrix]


def default_output_folder():
    if OUTPUT_FOLDER.strip():
        return Path(bpy.path.abspath(OUTPUT_FOLDER)).expanduser().resolve()
    return (Path.home() / "Desktop" / "KARV_UV_EXPORT").resolve()


def import_reference_if_requested():
    path_text = REFERENCE_GLB.strip()
    if not path_text:
        return None
    path = Path(bpy.path.abspath(path_text)).expanduser().resolve()
    if not path.is_file():
        raise FileNotFoundError(f"GLB não encontrado: {path}")
    before = {obj.as_pointer() for obj in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj.as_pointer() not in before]
    if not imported:
        raise RuntimeError("O Blender não informou objetos importados do GLB.")
    return path, imported


def candidate_mesh_objects(import_result):
    if import_result:
        return [obj for obj in import_result[1] if obj.type == "MESH"]
    selected = [obj for obj in bpy.context.selected_objects if obj.type == "MESH"]
    return selected or [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def find_face_object(objects, spec):
    wanted = {normalized_name(name) for name in spec["names"]}
    exact = []
    partial = []
    for obj in objects:
        object_name = normalized_name(obj.name)
        mesh_name = normalized_name(obj.data.name)
        if object_name in wanted or mesh_name in wanted:
            exact.append(obj)
        elif any(name in object_name or name in mesh_name for name in wanted):
            partial.append(obj)
    matches = exact or partial
    if len(matches) != 1:
        found = ", ".join(obj.name for obj in matches) or "nenhum"
        raise RuntimeError(
            f'{spec["face"]}: esperado um objeto; encontrados {len(matches)} ({found}).'
        )
    return matches[0]


def uv_hash(uv_layer):
    digest = hashlib.sha256()
    for item in uv_layer.data:
        digest.update(struct.pack("<ff", float(item.uv.x), float(item.uv.y)))
    return digest.hexdigest()


def uv_summary(mesh, uv_layer, index):
    coordinates = [item.uv for item in uv_layer.data]
    u_values = [float(uv.x) for uv in coordinates]
    v_values = [float(uv.y) for uv in coordinates]
    outside = sum(
        1
        for u, v in zip(u_values, v_values)
        if u < 0.0 or u > 1.0 or v < 0.0 or v > 1.0
    )

    per_vertex = {}
    for loop_index, loop in enumerate(mesh.loops):
        uv = coordinates[loop_index]
        per_vertex.setdefault(loop.vertex_index, set()).add(
            (round(float(uv.x), 7), round(float(uv.y), 7))
        )
    seam_vertices = sum(1 for values in per_vertex.values() if len(values) > 1)

    return {
        "index": index,
        "name": uv_layer.name,
        "gltf_semantic": f"TEXCOORD_{index}",
        "active": mesh.uv_layers.active == uv_layer,
        "active_render": bool(uv_layer.active_render),
        "loop_count": len(coordinates),
        "bounds": {
            "u_min": min(u_values) if u_values else None,
            "u_max": max(u_values) if u_values else None,
            "v_min": min(v_values) if v_values else None,
            "v_max": max(v_values) if v_values else None,
        },
        "coordinates_outside_0_1": outside,
        "vertices_with_uv_seams": seam_vertices,
        "sha256_float32_loop_order": uv_hash(uv_layer),
    }


def image_info(image):
    if image is None:
        return None
    packed_size = len(image.packed_file.data) if image.packed_file else 0
    return {
        "name": image.name,
        "size": [int(image.size[0]), int(image.size[1])],
        "filepath": image.filepath,
        "filepath_resolved": bpy.path.abspath(image.filepath) if image.filepath else "",
        "source": image.source,
        "colorspace": image.colorspace_settings.name,
        "packed": image.packed_file is not None,
        "packed_bytes": packed_size,
    }


def material_info(material):
    result = {
        "name": material.name,
        "use_nodes": bool(material.use_nodes),
        "blend_method": getattr(material, "blend_method", None),
        "nodes": [],
        "links": [],
    }
    if not material.use_nodes or not material.node_tree:
        return result

    for node in material.node_tree.nodes:
        item = {
            "name": node.name,
            "label": node.label,
            "type": node.type,
        }
        if node.type == "TEX_IMAGE":
            item.update(
                {
                    "image": image_info(node.image),
                    "extension": node.extension,
                    "interpolation": node.interpolation,
                    "projection": node.projection,
                }
            )
        elif node.type == "UVMAP":
            item["uv_map"] = node.uv_map
        elif node.type == "MAPPING":
            for socket_name in ("Location", "Rotation", "Scale"):
                socket = node.inputs.get(socket_name)
                if socket:
                    item[socket_name.lower()] = rounded(socket.default_value)
        result["nodes"].append(item)

    for link in material.node_tree.links:
        result["links"].append(
            {
                "from_node": link.from_node.name,
                "from_socket": link.from_socket.name,
                "to_node": link.to_node.name,
                "to_socket": link.to_socket.name,
            }
        )
    return result


def object_summary(obj, spec):
    mesh = obj.data
    layers = [uv_summary(mesh, layer, index) for index, layer in enumerate(mesh.uv_layers)]
    return {
        "face": spec["face"],
        "expected_uv": spec["expected_uv"],
        "object_name": obj.name,
        "mesh_name": mesh.name,
        "vertex_count": len(mesh.vertices),
        "edge_count": len(mesh.edges),
        "polygon_count": len(mesh.polygons),
        "loop_count": len(mesh.loops),
        "uv_layers": layers,
        "expected_uv_found": any(
            layer["gltf_semantic"] == spec["expected_uv"] for layer in layers
        ),
        "material_slots": [
            slot.material.name if slot.material else None for slot in obj.material_slots
        ],
        "transform": {
            "location": rounded(obj.location),
            "rotation_euler": rounded(obj.rotation_euler),
            "scale": rounded(obj.scale),
            "matrix_world": matrix_rows(obj.matrix_world),
        },
    }


def object_full_data(obj, spec):
    mesh = obj.data
    return {
        "face": spec["face"],
        "expected_uv": spec["expected_uv"],
        "object_name": obj.name,
        "mesh_name": mesh.name,
        "matrix_world": matrix_rows(obj.matrix_world),
        "vertices": [
            {
                "index": vertex.index,
                "co": rounded(vertex.co),
                "normal": rounded(vertex.normal),
            }
            for vertex in mesh.vertices
        ],
        "loops": [
            {"index": loop.index, "vertex_index": loop.vertex_index}
            for loop in mesh.loops
        ],
        "polygons": [
            {
                "index": polygon.index,
                "vertices": list(polygon.vertices),
                "loop_indices": list(polygon.loop_indices),
                "material_index": polygon.material_index,
                "use_smooth": bool(polygon.use_smooth),
            }
            for polygon in mesh.polygons
        ],
        "uv_layers": [
            {
                "index": index,
                "name": layer.name,
                "gltf_semantic": f"TEXCOORD_{index}",
                "uv_by_loop": [rounded(item.uv) for item in layer.data],
            }
            for index, layer in enumerate(mesh.uv_layers)
        ],
        "materials": [
            material_info(slot.material)
            for slot in obj.material_slots
            if slot.material is not None
        ],
        "custom_properties": {
            key: repr(obj[key]) for key in obj.keys() if key != "_RNA_UI"
        },
    }


def write_result_text(summary_path, full_path):
    text = bpy.data.texts.get("KARV_UV_EXPORT_RESULT") or bpy.data.texts.new(
        "KARV_UV_EXPORT_RESULT"
    )
    text.clear()
    text.write(
        "EXPORTAÇÃO CONCLUÍDA\n\n"
        f"Resumo: {summary_path}\n"
        f"Dados completos: {full_path}\n\n"
        "Envie os dois arquivos para análise."
    )


def main():
    import_result = import_reference_if_requested()
    objects = candidate_mesh_objects(import_result)
    if not objects:
        raise RuntimeError("Nenhuma malha encontrada na cena ou na seleção.")

    pairs = [(spec, find_face_object(objects, spec)) for spec in FACE_SPECS]
    output_folder = default_output_folder()
    output_folder.mkdir(parents=True, exist_ok=True)
    summary_path = output_folder / "karv_uv_reference_summary.json"
    full_path = output_folder / "karv_uv_reference_data.json.gz"
    source_path = str(import_result[0]) if import_result else bpy.data.filepath

    summary = {
        "format_version": 1,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "blender_version": bpy.app.version_string,
        "source_glb": source_path,
        "coordinate_space": "Blender mesh local space; matrix_world included separately",
        "uv_storage": "Blender loop/corner order",
        "faces": [object_summary(obj, spec) for spec, obj in pairs],
    }
    full_data = {
        "format_version": 1,
        "generated_at_utc": summary["generated_at_utc"],
        "blender_version": summary["blender_version"],
        "source_glb": source_path,
        "faces": [object_full_data(obj, spec) for spec, obj in pairs],
    }

    summary_path.write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    with gzip.open(full_path, "wt", encoding="utf-8", compresslevel=9) as stream:
        json.dump(full_data, stream, ensure_ascii=False, separators=(",", ":"))

    write_result_text(summary_path, full_path)
    print("\nKARV UV EXPORT concluído")
    print(f"Resumo: {summary_path}")
    print(f"Dados completos: {full_path}")
    for face in summary["faces"]:
        status = "OK" if face["expected_uv_found"] else "UV ESPERADA AUSENTE"
        print(
            f'- {face["face"]}: {face["object_name"]} | '
            f'{face["vertex_count"]} vértices | {status}'
        )


if __name__ == "__main__":
    main()
